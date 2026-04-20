"use client"

import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react"
import type {
  ChatMessage,
  RealtimeConnectionState,
} from "@/features/personal-chat/domain"
import {
  buildPersonalLoginRedirectPath,
  personalInboxPath,
} from "@/features/personal-chat/route-guard-paths"
import { PersonalChatApiError } from "./personal-chat-api"
import { updateConversationMessageCaches } from "./cache"
import {
  useConversationDetailQuery,
  useCreatePersonalChatRealtimeSessionMutation,
  useCreatePrivacyRoomLinkMutation,
  usePersonalSessionQuery,
  useSendPersonalChatMessageMutation,
} from "./hooks"
import { createMockRealtimeAdapter } from "./mock-realtime-adapter"
import type { RealtimeAdapter } from "./realtime-adapter"

const sameDayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

const monthDayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

const fallbackConnectionState: RealtimeConnectionState = {
  status: "idle",
  lastError: null,
}

const createClientMessageId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "PC"

const formatMessageTimestamp = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Just now"
  }

  const now = new Date()
  const isSameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()

  return isSameDay
    ? sameDayTimeFormatter.format(date)
    : monthDayTimeFormatter.format(date)
}

const getThreadErrorMessage = (error: unknown) => {
  if (error instanceof PersonalChatApiError) {
    if (error.status === 401) {
      return "Your session expired. Sign in again to continue this conversation."
    }

    if (error.status === 404) {
      return "This conversation could not be found."
    }

    return error.message || "We couldn't complete that conversation action."
  }

  return "We couldn't complete that conversation action."
}

const isConversationNotFoundError = (error: unknown) =>
  error instanceof PersonalChatApiError && error.status === 404

const isUnauthorizedError = (error: unknown) =>
  error instanceof PersonalChatApiError && error.status === 401

const buildPendingTextMessage = (input: {
  conversationId: string
  senderId: string
  text: string
  clientMessageId: string
}): ChatMessage => ({
  id: `pending-${input.clientMessageId}`,
  kind: "text",
  conversationId: input.conversationId,
  senderId: input.senderId,
  sentAt: new Date().toISOString(),
  deliveryStatus: "pending",
  clientMessageId: input.clientMessageId,
  text: input.text,
})

const buildPendingPrivacyLinkMessage = (input: {
  conversationId: string
  senderId: string
  clientMessageId: string
}): ChatMessage => {
  const placeholderRoomId = `pending-${input.clientMessageId}`

  return {
    id: `pending-${input.clientMessageId}`,
    kind: "privacy-link",
    conversationId: input.conversationId,
    senderId: input.senderId,
    sentAt: new Date().toISOString(),
    deliveryStatus: "pending",
    clientMessageId: input.clientMessageId,
    roomId: placeholderRoomId,
    roomUrl: `/private/room/${placeholderRoomId}`,
    label: "Preparing secure room...",
  }
}

const getConnectionLabel = (
  state: RealtimeConnectionState,
  realtimeNotice: string | null,
) => {
  if (state.status === "connected") {
    return "Realtime live"
  }

  if (state.status === "connecting" || state.status === "reconnecting") {
    return "Connecting"
  }

  if (realtimeNotice) {
    return "Direct send"
  }

  return state.status === "error" ? "Realtime issue" : "Standby"
}

const getConnectionTone = (
  state: RealtimeConnectionState,
  realtimeNotice: string | null,
) => {
  if (state.status === "connected") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
  }

  if (state.status === "connecting" || state.status === "reconnecting") {
    return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
  }

  if (realtimeNotice) {
    return "border-zinc-700 bg-zinc-900/70 text-zinc-300"
  }

  return state.status === "error"
    ? "border-red-900/70 bg-red-950/30 text-red-100"
    : "border-zinc-800 bg-zinc-900/50 text-zinc-400"
}

function MessageBubble({
  message,
  isOwnMessage,
}: {
  message: ChatMessage
  isOwnMessage: boolean
}) {
  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-3xl border px-4 py-3 ${
          isOwnMessage
            ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-50"
            : "border-zinc-800 bg-black/25 text-zinc-100"
        }`}
      >
        {message.kind === "privacy-link" ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                Secure room
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-200">
                {message.deliveryStatus === "pending"
                  ? "Generating a secure room handoff..."
                  : message.label}
              </p>
            </div>
            {message.deliveryStatus === "failed" ? (
              <p className="text-sm text-red-300">
                Secure room creation failed. Try again.
              </p>
            ) : message.deliveryStatus === "pending" ? (
              <span className="inline-flex rounded-full border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
                Preparing
              </span>
            ) : (
              <Link
                href={message.roomUrl}
                prefetch={false}
                className="inline-flex rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition-opacity hover:opacity-90"
              >
                Open secure room
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm leading-7">{message.text}</p>
        )}

        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.2em]">
          <span className="text-zinc-500">{formatMessageTimestamp(message.sentAt)}</span>
          <span
            className={
              message.deliveryStatus === "failed"
                ? "text-red-300"
                : message.deliveryStatus === "pending"
                  ? "text-amber-300"
                  : "text-zinc-500"
            }
          >
            {message.deliveryStatus}
          </span>
        </div>
      </div>
    </div>
  )
}

export function PersonalConversation({
  conversationId,
}: {
  conversationId: string
}) {
  const queryClient = useQueryClient()
  const sessionQuery = usePersonalSessionQuery()
  const conversationDetailQuery = useConversationDetailQuery(conversationId)
  const sendMessageMutation = useSendPersonalChatMessageMutation()
  const createPrivacyRoomLinkMutation = useCreatePrivacyRoomLinkMutation()
  const createRealtimeSessionMutation = useCreatePersonalChatRealtimeSessionMutation()
  const [composerValue, setComposerValue] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSendingText, setIsSendingText] = useState(false)
  const [isSharingPrivacyRoom, setIsSharingPrivacyRoom] = useState(false)
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>(
    fallbackConnectionState,
  )
  const [supportsRealtimeSend, setSupportsRealtimeSend] = useState(false)
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null)
  const composerInputRef = useRef<HTMLInputElement>(null)
  const messageViewportRef = useRef<HTMLDivElement>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const adapterRef = useRef<RealtimeAdapter | null>(null)
  const previousMessageCountRef = useRef(0)
  const isNearBottomRef = useRef(true)
  const optimisticMessagesRef = useRef(new Map<string, ChatMessage>())

  const session = sessionQuery.data
  const currentUser = session?.isAuthenticated ? session.user : null
  const conversation = conversationDetailQuery.data
  const authRedirectHref = buildPersonalLoginRedirectPath(
    `/personal/chat/${conversationId}`,
  )

  const clearPendingMessage = (clientMessageId?: string) => {
    if (clientMessageId) {
      optimisticMessagesRef.current.delete(clientMessageId)
    }
  }

  const markPendingMessageFailed = (
    clientMessageId: string | undefined,
    fallbackMessage: string,
  ) => {
    if (!clientMessageId) {
      setActionError(fallbackMessage)
      return
    }

    const pendingMessage = optimisticMessagesRef.current.get(clientMessageId)

    if (!pendingMessage) {
      setActionError(fallbackMessage)
      return
    }

    const failedMessage: ChatMessage = {
      ...pendingMessage,
      deliveryStatus: "failed",
    }

    optimisticMessagesRef.current.set(clientMessageId, failedMessage)
    updateConversationMessageCaches(queryClient, failedMessage)
    setActionError(fallbackMessage)
  }

  const handleRealtimeMessage = useEffectEvent((message: ChatMessage) => {
    updateConversationMessageCaches(queryClient, message)
    clearPendingMessage(message.clientMessageId)
  })

  const handleRealtimeFailure = useEffectEvent(
    (payload: { error: string; clientMessageId?: string; conversationId?: string }) => {
      if (payload.conversationId && payload.conversationId !== conversationId) {
        return
      }

      markPendingMessageFailed(payload.clientMessageId, payload.error)
    },
  )

  const bootstrapRealtimeSession = useEffectEvent(async () => {
    setSupportsRealtimeSend(false)
    setRealtimeNotice(null)
    setConnectionState({
      status: "connecting",
      lastError: null,
    })

    const bootstrap = await createRealtimeSessionMutation.mutateAsync({
      conversationId,
    })

    if (bootstrap.provider !== "mock") {
      setConnectionState(fallbackConnectionState)
      setRealtimeNotice(
        "Realtime bridge is not available in this client mode yet. Sending will use direct requests.",
      )
      return { adapter: null, release: () => {} }
    }

    const adapter = createMockRealtimeAdapter()
    const offConnection = adapter.onConnectionStateChange((state) => {
      setConnectionState(state)
    })
    const offNewMessage = adapter.on("message:new", ({ message }) => {
      handleRealtimeMessage(message)
    })
    const offMessageError = adapter.on("message:error", (payload) => {
      handleRealtimeFailure(payload)
    })

    await adapter.connect(bootstrap)
    const joinAck = await adapter.joinConversation({ conversationId })

    if (!joinAck.ok) {
      offConnection()
      offNewMessage()
      offMessageError()
      adapter.disconnect()
      setConnectionState({
        status: "error",
        lastError: joinAck.error,
      })
      return { adapter: null, release: () => {} }
    }

    adapterRef.current = adapter
    setSupportsRealtimeSend(true)
    setConnectionState(adapter.getConnectionState())

    return {
      adapter,
      release: () => {
        offConnection()
        offNewMessage()
        offMessageError()
      },
    }
  })

  useEffect(() => {
    if (!conversation?.id) {
      return
    }

    let cancelled = false
    let teardown = {
      adapter: null as RealtimeAdapter | null,
      release: () => {},
    }

    optimisticMessagesRef.current = new Map()

    void (async () => {
      try {
        teardown = await bootstrapRealtimeSession()

        if (cancelled && teardown.adapter) {
          void teardown.adapter.leaveConversation({ conversationId })
          teardown.adapter.disconnect()
        }
      } catch (error) {
        if (!cancelled) {
          setSupportsRealtimeSend(false)
          setConnectionState({
            status: "error",
            lastError: getThreadErrorMessage(error),
          })
          setRealtimeNotice(
            "Realtime setup failed. Sending will use direct requests until the connection is restored.",
          )
        }
      }
    })()

    return () => {
      cancelled = true
      optimisticMessagesRef.current = new Map()
      teardown.release()

      if (teardown.adapter) {
        void teardown.adapter.leaveConversation({ conversationId })
        teardown.adapter.disconnect()
      }

      adapterRef.current = null
      setSupportsRealtimeSend(false)
    }
  }, [conversation?.id, conversationId])

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

  const handleMessageViewportScroll = () => {
    const viewport = messageViewportRef.current

    if (!viewport) {
      return
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    isNearBottomRef.current = distanceFromBottom < 120
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
      if (supportsRealtimeSend && adapterRef.current) {
        const ack = await adapterRef.current.sendMessage({
          conversationId: conversation.id,
          body: trimmedComposerValue,
          clientMessageId,
        })

        if (!ack.ok) {
          markPendingMessageFailed(clientMessageId, ack.error)
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

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/70">
        <div className="border-b border-zinc-800 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
                Direct message
              </p>
              <h2 className="mt-2 truncate text-2xl font-semibold text-white">
                {conversation.participant.displayName}
              </h2>
              <p className="mt-1 truncate text-sm text-zinc-500">
                @{conversation.participant.handle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={personalInboxPath}
                prefetch={false}
                className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
              >
                Inbox
              </Link>
              <span
                className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.2em] ${getConnectionTone(
                  connectionState,
                  realtimeNotice,
                )}`}
              >
                {getConnectionLabel(connectionState, realtimeNotice)}
              </span>
            </div>
          </div>
          {realtimeNotice ? (
            <p className="mt-3 text-sm text-zinc-500">{realtimeNotice}</p>
          ) : null}
          {connectionState.lastError ? (
            <p className="mt-2 text-sm text-red-300">
              {connectionState.lastError}
            </p>
          ) : null}
        </div>

        {actionError ? (
          <div
            role="alert"
            className="border-b border-red-900/70 bg-red-950/30 px-5 py-3 text-sm text-red-100"
          >
            {actionError}
          </div>
        ) : null}

        <div
          ref={messageViewportRef}
          onScroll={handleMessageViewportScroll}
          className="scrollbar-subtle flex h-[24rem] flex-col overflow-y-auto px-5 py-5 sm:h-[28rem] xl:h-[calc(100vh-20rem)]"
        >
          {conversation.messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md rounded-3xl border border-dashed border-zinc-800 bg-black/20 px-5 py-8 text-center">
                <p className="text-sm font-medium text-white">
                  No messages yet
                </p>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Start the thread with a note or send a secure-room handoff.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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

        <div className="border-t border-zinc-800 bg-black/25 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
                Composer
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Press Enter to send.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleSharePrivacyRoom()
              }}
              disabled={composerDisabled}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSharingPrivacyRoom ? "Sharing secure room..." : "Share Secure Room"}
            </button>
          </div>

          <div className="mt-4 flex gap-4">
            <div className="group relative flex-1">
              <span className="absolute top-1/2 left-4 -translate-y-1/2 text-cyan-400">
                {">"}
              </span>
              <input
                ref={composerInputRef}
                autoFocus
                type="text"
                value={composerValue}
                onChange={(event) => setComposerValue(event.target.value)}
                disabled={composerDisabled}
                maxLength={5000}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void handleSendMessage()
                  }
                }}
                placeholder={
                  currentUser
                    ? "Type message..."
                    : "Loading your personal session..."
                }
                className="w-full border border-zinc-800 bg-black py-3 pr-4 pl-8 text-sm text-zinc-100 placeholder:text-zinc-700 transition-colors focus:border-zinc-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                void handleSendMessage()
              }}
              disabled={composerDisabled || composerValue.trim().length === 0}
              className="cursor-pointer bg-zinc-800 px-6 text-sm font-bold text-zinc-400 transition-all hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSendingText ? "SENDING" : "SEND"}
            </button>
          </div>
        </div>
    </section>
  )
}
