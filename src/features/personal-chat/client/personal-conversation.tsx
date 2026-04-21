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
  RealtimeSessionBootstrap,
} from "@/features/personal-chat/domain"
import {
  buildPersonalLoginRedirectPath,
  personalInboxPath,
} from "@/features/personal-chat/route-guard-paths"
import { PersonalChatApiError } from "./personal-chat-api"
import { PersonalProfileMenu } from "./personal-profile-menu"
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
import { createSocketIoRealtimeAdapter } from "./socketio-realtime-adapter"

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

interface RealtimeJoinState {
  status: "idle" | "joining" | "joined" | "error"
  lastError: string | null
}

interface ActiveRealtimeBinding {
  adapter: RealtimeAdapter | null
  joinedConversationId: string | null
  release: () => void
}

const fallbackJoinState: RealtimeJoinState = {
  status: "idle",
  lastError: null,
}

const emptyRealtimeBinding: ActiveRealtimeBinding = {
  adapter: null,
  joinedConversationId: null,
  release: () => {},
}

const createClientMessageId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

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

const createRealtimeAdapterForBootstrap = (
  bootstrap: RealtimeSessionBootstrap,
): RealtimeAdapter => {
  if (bootstrap.provider === "mock") {
    return createMockRealtimeAdapter()
  }

  return createSocketIoRealtimeAdapter()
}

const getRealtimeIndicator = (
  connectionState: RealtimeConnectionState,
  joinState: RealtimeJoinState,
) => {
  if (connectionState.status === "reconnecting") {
    return {
      label: "Reconnecting",
      dotClassName: "bg-amber-300",
      className: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    }
  }

  if (connectionState.status === "error" || joinState.status === "error") {
    return {
      label: "Error",
      dotClassName: "bg-red-300",
      className: "border-red-400/30 bg-red-500/10 text-red-100",
    }
  }

  if (
    connectionState.status === "connecting" ||
    joinState.status === "joining" ||
    connectionState.status === "disconnected"
  ) {
    return {
      label: "Connecting",
      dotClassName: "bg-cyan-300",
      className: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
    }
  }

  if (connectionState.status === "connected" && joinState.status === "joined") {
    return {
      label: "Connected",
      dotClassName: "bg-emerald-300",
      className: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
    }
  }

  return null
}

const getRealtimeStatusError = (
  connectionState: RealtimeConnectionState,
  joinState: RealtimeJoinState,
) => connectionState.lastError ?? joinState.lastError

const cleanupRealtimeBinding = async (binding: ActiveRealtimeBinding) => {
  if (binding.adapter && binding.joinedConversationId) {
    try {
      await binding.adapter.leaveConversation({
        conversationId: binding.joinedConversationId,
      })
    } catch {
      // Cleanup should remain best-effort during thread switches and unmounts.
    }
  }

  binding.release()
  binding.adapter?.disconnect()
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
  const [joinState, setJoinState] = useState<RealtimeJoinState>(fallbackJoinState)
  const composerInputRef = useRef<HTMLInputElement>(null)
  const messageViewportRef = useRef<HTMLDivElement>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)
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

  const bootstrapRealtimeSession = useEffectEvent(async () => {
    setConnectionState({
      status: "connecting",
      lastError: null,
    })
    setJoinState({
      status: "joining",
      lastError: null,
    })

    const bootstrap = await createRealtimeSessionMutation.mutateAsync({
      conversationId,
    })
    const adapter = createRealtimeAdapterForBootstrap(bootstrap)
    const offConnection = adapter.onConnectionStateChange((state) => {
      setConnectionState(state)
    })

    await adapter.connect(bootstrap)
    const joinAck = await adapter.joinConversation({ conversationId })

    if (!joinAck.ok) {
      setJoinState({
        status: "error",
        lastError: joinAck.error,
      })
      await cleanupRealtimeBinding({
        adapter,
        joinedConversationId: null,
        release: () => {
          offConnection()
        },
      })
      return emptyRealtimeBinding
    }

    setJoinState({
      status: "joined",
      lastError: null,
    })
    setConnectionState(adapter.getConnectionState())

    return {
      adapter,
      joinedConversationId: conversationId,
      release: () => {
        offConnection()
      },
    }
  })

  useEffect(() => {
    if (!conversation?.id) {
      return
    }

    let cancelled = false
    let teardown = emptyRealtimeBinding

    optimisticMessagesRef.current = new Map()
    setConnectionState(fallbackConnectionState)
    setJoinState(fallbackJoinState)

    void (async () => {
      try {
        teardown = await bootstrapRealtimeSession()

        if (cancelled && teardown.adapter) {
          void cleanupRealtimeBinding(teardown)
        }
      } catch (error) {
        if (!cancelled) {
          setConnectionState({
            status: "error",
            lastError: getThreadErrorMessage(error),
          })
          setJoinState({
            status: "error",
            lastError: null,
          })
        }
      }
    })()

    return () => {
      cancelled = true
      optimisticMessagesRef.current = new Map()
      void cleanupRealtimeBinding(teardown)
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
      const message = await sendMessageMutation.mutateAsync({
        conversationId: conversation.id,
        text: trimmedComposerValue,
        clientMessageId,
      })

      clearPendingMessage(message.clientMessageId)

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
  const sessionForProfileMenu = session ?? {
    isAuthenticated: false,
    user: null,
  }
  const realtimeIndicator = getRealtimeIndicator(connectionState, joinState)
  const realtimeStatusError = getRealtimeStatusError(connectionState, joinState)

  return (
    <section className="flex min-h-[100dvh] flex-col overflow-hidden border border-zinc-800 bg-zinc-950/70 sm:min-h-[calc(100dvh-2rem)] sm:rounded-3xl">
      <div className="border-b border-zinc-800 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {conversation.participant.displayName}
              </h2>
              <p className="truncate text-sm text-zinc-500">
                @{conversation.participant.handle}
              </p>
            </div>
            {realtimeIndicator ? (
              <div
                className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${realtimeIndicator.className}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${realtimeIndicator.dotClassName}`}
                />
                <span>{realtimeIndicator.label}</span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={personalInboxPath}
              prefetch={false}
              className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
            >
              Inbox
            </Link>
            <PersonalProfileMenu session={sessionForProfileMenu} compact />
          </div>
        </div>
        {realtimeStatusError ? (
          <p className="mt-2 text-sm text-red-300">
            {realtimeStatusError}
          </p>
        ) : null}
      </div>

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
        className="scrollbar-subtle flex min-h-[18rem] flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-5"
      >
        {conversation.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-3xl border border-dashed border-zinc-800 bg-black/20 px-5 py-8 text-center">
              <p className="text-sm font-medium text-white">
                No messages yet
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Send the first message to start chatting.
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

      <div className="border-t border-zinc-800 bg-black/25 px-4 py-4 sm:px-5">
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
