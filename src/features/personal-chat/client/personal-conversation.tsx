"use client"

import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type {
  ChatMessage,
  ConversationDetail,
  MessageSendAck,
} from "@/features/personal-chat/domain"
import { generateKey } from "@/lib/encryption"
import {
  buildPersonalLoginRedirectPath,
  personalInboxPath,
} from "@/features/personal-chat/route-guard-paths"
import { updateConversationMessageCaches } from "./cache"
import {
  DEFAULT_CONVERSATION_HISTORY_PAGE_SIZE,
  flattenConversationHistoryPages,
} from "./conversation-history-pagination"
import { PersonalConversationComposer } from "./personal-conversation-composer"
import { PersonalConversationHeader } from "./personal-conversation-header"
import { MessageBubble } from "./personal-conversation-message-bubble"
import { getConversationDetail } from "./personal-chat-api"
import {
  buildPendingPrivacyLinkMessage,
  buildPendingTextMessage,
  createClientMessageId,
  getRealtimeIndicator,
  getRealtimeStatusError,
  getThreadErrorMessage,
  isConversationNotFoundError,
  isUnauthorizedError,
} from "./personal-conversation-shared"
import {
  useConversationDetailQuery,
  useCreatePrivacyRoomLinkMutation,
  usePersonalSessionQuery,
  useSendPersonalChatMessageMutation,
} from "./hooks"
import { personalChatQueryKeys } from "./query-keys"
import { usePersonalConversationRealtime } from "./use-personal-conversation-realtime"

export function PersonalConversation({
  conversationId,
}: {
  conversationId: string
}) {
  const queryClient = useQueryClient()
  const sessionQuery = usePersonalSessionQuery()
  const conversationDetailQuery = useConversationDetailQuery(conversationId, {
    limit: DEFAULT_CONVERSATION_HISTORY_PAGE_SIZE,
  })
  const sendMessageMutation = useSendPersonalChatMessageMutation()
  const createPrivacyRoomLinkMutation = useCreatePrivacyRoomLinkMutation()
  const [composerValue, setComposerValue] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSendingText, setIsSendingText] = useState(false)
  const [isSharingPrivacyRoom, setIsSharingPrivacyRoom] = useState(false)
  const [olderHistoryPages, setOlderHistoryPages] = useState<ConversationDetail[]>([])
  const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false)
  const composerInputRef = useRef<HTMLInputElement>(null)
  const messageViewportRef = useRef<HTMLDivElement>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const previousMessageCountRef = useRef(0)
  const isNearBottomRef = useRef(true)
  const optimisticMessagesRef = useRef(new Map<string, ChatMessage>())
  const isLoadingOlderHistoryRef = useRef(false)
  const pendingHistoryScrollAdjustmentRef = useRef<{
    previousScrollHeight: number
    previousScrollTop: number
  } | null>(null)

  const session = sessionQuery.data
  const currentUser = session?.isAuthenticated ? session.user : null
  const latestConversationPage = conversationDetailQuery.data
  const conversation =
    flattenConversationHistoryPages(
      latestConversationPage
        ? [...olderHistoryPages, latestConversationPage]
        : olderHistoryPages,
    ) ?? latestConversationPage
  const authRedirectHref = buildPersonalLoginRedirectPath(
    `/personal/chat/${conversationId}`,
  )

  const clearPendingMessage = (clientMessageId?: string) => {
    if (clientMessageId) {
      optimisticMessagesRef.current.delete(clientMessageId)
    }
  }

  const failPendingMessage = (clientMessageId?: string) => {
    if (!clientMessageId) {
      return false
    }

    const pendingMessage = optimisticMessagesRef.current.get(clientMessageId)

    if (!pendingMessage) {
      return false
    }

    const failedMessage: ChatMessage = {
      ...pendingMessage,
      deliveryStatus: "failed",
    }

    optimisticMessagesRef.current.set(clientMessageId, failedMessage)
    updateConversationMessageCaches(queryClient, failedMessage)
    return true
  }

  const markPendingMessageFailed = (
    clientMessageId: string | undefined,
    fallbackMessage: string,
  ) => {
    failPendingMessage(clientMessageId)
    setActionError(fallbackMessage)
  }

  const acknowledgePendingMessage = (
    ack: Pick<MessageSendAck, "clientMessageId" | "messageId">,
    fallbackClientMessageId?: string,
  ) => {
    const clientMessageId = ack.clientMessageId ?? fallbackClientMessageId

    if (!clientMessageId) {
      return false
    }

    const pendingMessage = optimisticMessagesRef.current.get(clientMessageId)

    if (!pendingMessage) {
      return false
    }

    const sentMessage: ChatMessage = {
      ...pendingMessage,
      id: ack.messageId ?? pendingMessage.id,
      deliveryStatus: "sent",
    }

    optimisticMessagesRef.current.set(clientMessageId, sentMessage)
    updateConversationMessageCaches(queryClient, sentMessage)
    return true
  }

  const resolveRealtimeClientMessageId = (message: ChatMessage) => {
    if (message.clientMessageId) {
      return message.clientMessageId
    }

    if (!currentUser || message.senderId !== currentUser.id) {
      return undefined
    }

    const optimisticEntries = Array.from(optimisticMessagesRef.current.entries())

    for (let index = optimisticEntries.length - 1; index >= 0; index -= 1) {
      const [clientMessageId, optimisticMessage] = optimisticEntries[index]!

      if (
        optimisticMessage.conversationId !== message.conversationId ||
        optimisticMessage.senderId !== message.senderId ||
        optimisticMessage.deliveryStatus === "failed" ||
        optimisticMessage.kind !== message.kind
      ) {
        continue
      }

      if (
        optimisticMessage.kind === "text" &&
        message.kind === "text" &&
        optimisticMessage.text === message.text
      ) {
        return clientMessageId
      }

      if (
        optimisticMessage.kind === "privacy-link" &&
        message.kind === "privacy-link"
      ) {
        return clientMessageId
      }
    }

    return undefined
  }

  const { connectionState, joinState, sendRealtimeMessage } =
    usePersonalConversationRealtime({
      conversationId,
      enabled: Boolean(conversation?.id),
      onRealtimeMessage: (message) => {
        const resolvedClientMessageId = resolveRealtimeClientMessageId(message)
        const reconciledMessage =
          resolvedClientMessageId && !message.clientMessageId
            ? {
                ...message,
                clientMessageId: resolvedClientMessageId,
              }
            : message

        updateConversationMessageCaches(queryClient, reconciledMessage)
        clearPendingMessage(reconciledMessage.clientMessageId)
      },
      onRealtimeError: (payload) => {
        const matchedPendingMessage = failPendingMessage(payload.clientMessageId)

        if (matchedPendingMessage) {
          setActionError(null)
          return
        }

        setActionError(payload.error)
      },
    })

  useEffect(() => {
    if (!latestConversationPage?.id) {
      optimisticMessagesRef.current = new Map()
      return
    }

    optimisticMessagesRef.current = new Map()

    return () => {
      optimisticMessagesRef.current = new Map()
    }
  }, [latestConversationPage?.id])

  useEffect(() => {
    setOlderHistoryPages([])
    setIsLoadingOlderHistory(false)
    isLoadingOlderHistoryRef.current = false
    pendingHistoryScrollAdjustmentRef.current = null
  }, [conversationId])

  useLayoutEffect(() => {
    const viewport = messageViewportRef.current
    const pendingAdjustment = pendingHistoryScrollAdjustmentRef.current

    if (!viewport || !pendingAdjustment) {
      return
    }

    viewport.scrollTop =
      pendingAdjustment.previousScrollTop +
      (viewport.scrollHeight - pendingAdjustment.previousScrollHeight)
    pendingHistoryScrollAdjustmentRef.current = null
  }, [conversation?.messages.length])

  useEffect(() => {
    const viewport = messageViewportRef.current

    if (!viewport) {
      return
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    isNearBottomRef.current = distanceFromBottom < 120
  }, [conversation?.messages.length])

  useEffect(() => {
    const messageCount = conversation?.messages.length ?? 0

    if (!messageCount) {
      previousMessageCountRef.current = 0
      return
    }

    const isInitialLoad = previousMessageCountRef.current === 0
    const hasNewMessages = messageCount > previousMessageCountRef.current

    if (isInitialLoad || (hasNewMessages && isNearBottomRef.current)) {
      messageEndRef.current?.scrollIntoView({
        behavior: isInitialLoad ? "auto" : "smooth",
        block: "end",
      })
    }

    previousMessageCountRef.current = messageCount
  }, [conversation?.messages.length])

  const loadOlderHistory = async () => {
    if (!conversation || isLoadingOlderHistoryRef.current || !conversation.hasMoreHistory) {
      return
    }

    const oldestLoadedMessage = conversation.messages[0]
    const viewport = messageViewportRef.current

    if (!oldestLoadedMessage) {
      return
    }

    if (viewport) {
      pendingHistoryScrollAdjustmentRef.current = {
        previousScrollHeight: viewport.scrollHeight,
        previousScrollTop: viewport.scrollTop,
      }
    }

    isLoadingOlderHistoryRef.current = true
    setIsLoadingOlderHistory(true)

    try {
      const olderPage = await queryClient.fetchQuery({
        queryKey: personalChatQueryKeys.conversationDetail(conversation.id, {
          limit: DEFAULT_CONVERSATION_HISTORY_PAGE_SIZE,
          before: oldestLoadedMessage.id,
        }),
        queryFn: () =>
          getConversationDetail(conversation.id, {
            limit: DEFAULT_CONVERSATION_HISTORY_PAGE_SIZE,
            before: oldestLoadedMessage.id,
          }),
      })

      const olderPageOldestMessageId = olderPage.messages[0]?.id
      const olderPageNewestMessageId =
        olderPage.messages[olderPage.messages.length - 1]?.id
      const isDuplicatePage = olderHistoryPages.some((page) => {
        const currentOldestMessageId = page.messages[0]?.id
        const currentNewestMessageId = page.messages[page.messages.length - 1]?.id

        return (
          currentOldestMessageId === olderPageOldestMessageId &&
          currentNewestMessageId === olderPageNewestMessageId
        )
      })

      if (isDuplicatePage) {
        pendingHistoryScrollAdjustmentRef.current = null
        return
      }

      setOlderHistoryPages((currentPages) => [olderPage, ...currentPages])
    } catch (error) {
      pendingHistoryScrollAdjustmentRef.current = null
      setActionError(getThreadErrorMessage(error))
    } finally {
      isLoadingOlderHistoryRef.current = false
      setIsLoadingOlderHistory(false)
    }
  }

  const handleMessageViewportScroll = () => {
    const viewport = messageViewportRef.current

    if (!viewport) {
      return
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    isNearBottomRef.current = distanceFromBottom < 120

    if (
      viewport.scrollTop <= 96 &&
      conversation?.hasMoreHistory &&
      !isLoadingOlderHistoryRef.current
    ) {
      void loadOlderHistory()
    }
  }

  const handleSendMessage = async () => {
    const trimmedComposerValue = composerValue.trim()

    if (
      !trimmedComposerValue ||
      !conversation ||
      !currentUser ||
      isSendingText ||
      isSharingPrivacyRoom
    ) {
      return
    }

    const clientMessageId = createClientMessageId()
    const pendingMessage = buildPendingTextMessage({
      conversationId: conversation.id,
      senderId: currentUser.id,
      text: trimmedComposerValue,
      clientMessageId,
    })

    optimisticMessagesRef.current.set(clientMessageId, pendingMessage)
    updateConversationMessageCaches(queryClient, pendingMessage)
    setComposerValue("")
    setActionError(null)
    setIsSendingText(true)

    try {
      const realtimeAck = await sendRealtimeMessage({
        conversationId: conversation.id,
        body: trimmedComposerValue,
        clientMessageId,
      })

      if (realtimeAck) {
        if (!realtimeAck.ok) {
          markPendingMessageFailed(clientMessageId, realtimeAck.error)
        } else {
          acknowledgePendingMessage(realtimeAck, clientMessageId)
        }
      } else {
        const message = await sendMessageMutation.mutateAsync({
          conversationId: conversation.id,
          text: trimmedComposerValue,
          clientMessageId,
        })

        clearPendingMessage(message.clientMessageId)
      }

      composerInputRef.current?.focus()
    } catch (error) {
      markPendingMessageFailed(clientMessageId, getThreadErrorMessage(error))
    } finally {
      setIsSendingText(false)
    }
  }

  const handleSharePrivacyRoom = async () => {
    if (!conversation || !currentUser || isSharingPrivacyRoom || isSendingText) {
      return
    }

    const clientMessageId = createClientMessageId()
    const encryptionKey = generateKey()
    const pendingMessage = buildPendingPrivacyLinkMessage({
      conversationId: conversation.id,
      senderId: currentUser.id,
      clientMessageId,
    })

    optimisticMessagesRef.current.set(clientMessageId, pendingMessage)
    updateConversationMessageCaches(queryClient, pendingMessage)
    setActionError(null)
    setIsSharingPrivacyRoom(true)

    try {
      const message = await createPrivacyRoomLinkMutation.mutateAsync({
        conversationId: conversation.id,
        encryptionKey,
        clientMessageId,
      })

      clearPendingMessage(message.clientMessageId)
    } catch (error) {
      markPendingMessageFailed(clientMessageId, getThreadErrorMessage(error))
    } finally {
      setIsSharingPrivacyRoom(false)
    }
  }

  if (conversationDetailQuery.isPending) {
    return (
      <section className="space-y-6">
        <div className="h-32 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/40" />
        <div className="h-[38rem] animate-pulse rounded-3xl border border-zinc-800 bg-zinc-950/60" />
      </section>
    )
  }

  if (conversationDetailQuery.isError) {
    const error = conversationDetailQuery.error

    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950/70 p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Conversation
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-white">
          {isConversationNotFoundError(error)
            ? "Conversation not found"
            : isUnauthorizedError(error)
              ? "Sign in required"
              : "Unable to load this thread"}
        </h2>
        <p className="mt-4 text-sm leading-7 text-zinc-400">
          {isConversationNotFoundError(error)
            ? "This thread may have been removed or never existed in the current personal-chat backend."
            : isUnauthorizedError(error)
              ? "Your personal-chat session is no longer active. Sign in again and we will return you to this conversation."
              : getThreadErrorMessage(error)}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {isUnauthorizedError(error) ? (
            <Link
              href={authRedirectHref}
              prefetch={false}
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
            >
              Sign in again
            </Link>
          ) : isConversationNotFoundError(error) ? null : (
            <button
              type="button"
              onClick={() => {
                void conversationDetailQuery.refetch()
              }}
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
            >
              Retry
            </button>
          )}
          <Link
            href={personalInboxPath}
            prefetch={false}
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
          >
            Back to inbox
          </Link>
        </div>
      </section>
    )
  }

  if (!conversation) {
    return null
  }

  const composerDisabled = !currentUser || isSendingText || isSharingPrivacyRoom
  const sessionForProfileMenu = session ?? {
    isAuthenticated: false,
    user: null,
  }
  const realtimeIndicator = getRealtimeIndicator(connectionState, joinState)
  const realtimeStatusError = getRealtimeStatusError(connectionState, joinState)

  return (
    <section className="flex min-h-[100dvh] flex-col overflow-hidden border border-zinc-800 bg-zinc-950/70 sm:min-h-[calc(100dvh-2rem)] sm:rounded-3xl">
      <PersonalConversationHeader
        participant={conversation.participant}
        session={sessionForProfileMenu}
        realtimeIndicator={realtimeIndicator}
        realtimeStatusError={realtimeStatusError}
      />

      {actionError ? (
        <div
          role="alert"
          className="border-b border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-100 sm:px-5"
        >
          {actionError}
        </div>
      ) : null}

      <div
        ref={messageViewportRef}
        onScroll={handleMessageViewportScroll}
        data-testid="conversation-message-viewport"
        className="scrollbar-subtle flex min-h-[18rem] flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-5"
      >
        {conversation.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-3xl border border-dashed border-zinc-800 bg-black/20 px-5 py-8 text-center">
              <p className="text-sm font-medium text-white">No messages yet</p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Send the first message to start chatting.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {conversation.hasMoreHistory || isLoadingOlderHistory ? (
              <div className="flex justify-center">
                <div className="rounded-full border border-zinc-800 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                  {isLoadingOlderHistory
                    ? "Loading older messages"
                    : "Scroll up for older messages"}
                </div>
              </div>
            ) : null}
            {conversation.messages.map((message) => (
              <MessageBubble
                key={`${message.id}:${message.clientMessageId ?? "server"}`}
                message={message}
                isOwnMessage={message.senderId === currentUser?.id}
              />
            ))}
          </div>
        )}
        <div ref={messageEndRef} />
      </div>

      <PersonalConversationComposer
        currentUser={currentUser}
        composerValue={composerValue}
        composerDisabled={composerDisabled}
        isSendingText={isSendingText}
        isSharingPrivacyRoom={isSharingPrivacyRoom}
        composerInputRef={composerInputRef}
        onComposerValueChange={setComposerValue}
        onSendMessage={() => {
          void handleSendMessage()
        }}
        onSharePrivacyRoom={() => {
          void handleSharePrivacyRoom()
        }}
      />
    </section>
  )
}
