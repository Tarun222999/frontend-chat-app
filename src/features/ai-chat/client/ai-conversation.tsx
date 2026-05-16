"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import type {
  AiChatMessage,
  AiMessageRole,
  AiMessageStatus,
  AiModelProfile,
} from "@/features/ai-chat/domain"
import { AiChatApiError } from "./ai-chat-api"
import {
  useAiConversationDetailQuery,
  useStreamAiMessageMutation,
} from "./hooks"
import { aiChatQueryKeys } from "./query-keys"

const MESSAGE_PAGE_SIZE = 100

const profileLabels: Record<AiModelProfile, string> = {
  free: "Free",
  fast: "Fast",
  balanced: "Balanced",
}

const roleLabels: Record<AiMessageRole, string> = {
  user: "You",
  assistant: "AI",
  system: "System",
}

const statusLabels: Record<AiMessageStatus, string> = {
  pending: "Pending",
  streaming: "Generating",
  complete: "Complete",
  failed: "Failed",
  cancelled: "Stopped",
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

const formatMessageTime = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Recent"
  }

  return timeFormatter.format(date)
}

const getConversationErrorMessage = (error: unknown) => {
  if (error instanceof AiChatApiError) {
    if (error.status === 401) {
      return "Your session expired. Sign in again to continue AI Chat."
    }

    if (error.status === 404) {
      return "This AI conversation was not found."
    }

    return error.message || "We couldn't load this AI conversation."
  }

  return "We couldn't load this AI conversation."
}

const getSendErrorMessage = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return null
  }

  if (error instanceof AiChatApiError) {
    if (error.status === 401) {
      return "Your session expired. Sign in again to continue AI Chat."
    }

    return error.message || "We couldn't send that AI message."
  }

  return "We couldn't send that AI message."
}

const getMessageTone = (message: AiChatMessage) => {
  if (message.role === "user") {
    return "ml-auto border-orange-300/25 bg-orange-400 text-black"
  }

  if (message.role === "system") {
    return "mx-auto max-w-2xl border-zinc-800 bg-zinc-950/80 text-zinc-300"
  }

  if (message.status === "failed") {
    return "mr-auto border-red-900/70 bg-red-950/30 text-red-50"
  }

  if (message.status === "cancelled") {
    return "mr-auto border-zinc-700 bg-zinc-900/60 text-zinc-200"
  }

  return "mr-auto border-zinc-800/80 bg-zinc-950/80 text-zinc-100"
}

function MessageBubble({ message }: { message: AiChatMessage }) {
  const isAssistant = message.role === "assistant"
  const profileLabel =
    isAssistant && message.model ? profileLabels[message.model.profile] : null
  const shouldShowStatus = message.status !== "complete"

  return (
    <article
      className={`max-w-[min(46rem,92%)] rounded-3xl border px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.14)] ${getMessageTone(message)}`}
    >
      <div className="flex items-center justify-between gap-4">
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${
            message.role === "user" ? "text-black/55" : "text-zinc-500"
          }`}
        >
          {roleLabels[message.role]}
        </p>
        <p
          className={`shrink-0 text-[11px] uppercase tracking-[0.18em] ${
            message.role === "user" ? "text-black/45" : "text-zinc-600"
          }`}
        >
          {formatMessageTime(message.createdAt)}
        </p>
      </div>

      <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">
        {message.content || (
          <span className="text-zinc-500">{statusLabels[message.status]}</span>
        )}
      </div>

      {profileLabel || shouldShowStatus || message.errorMessage ? (
        <footer
          className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.18em] ${
            message.role === "user" ? "text-black/45" : "text-zinc-600"
          }`}
        >
          {profileLabel ? <span>{profileLabel}</span> : null}
          {shouldShowStatus ? <span>{statusLabels[message.status]}</span> : null}
          {message.errorMessage ? (
            <span className="normal-case tracking-normal text-red-200">
              {message.errorMessage}
            </span>
          ) : null}
        </footer>
      ) : null}
    </article>
  )
}

function MessageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-28 max-w-[42rem] animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/45" />
      <div className="ml-auto h-24 max-w-[34rem] animate-pulse rounded-3xl border border-orange-400/15 bg-orange-400/10" />
      <div className="h-36 max-w-[46rem] animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/45" />
    </div>
  )
}

export function AiConversation({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient()
  const conversationQuery = useAiConversationDetailQuery(conversationId, {
    limit: MESSAGE_PAGE_SIZE,
  })
  const streamMessageMutation = useStreamAiMessageMutation()
  const conversation = conversationQuery.data
  const messageViewportRef = useRef<HTMLDivElement | null>(null)
  const activeAbortControllerRef = useRef<AbortController | null>(null)
  const [draft, setDraft] = useState("")
  const [localMessages, setLocalMessages] = useState<AiChatMessage[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const selectedProfile = conversation?.model.profile ?? "free"
  const displayedMessages = useMemo(
    () => [...(conversation?.messages ?? []), ...localMessages],
    [conversation?.messages, localMessages],
  )

  useEffect(() => {
    const viewport = messageViewportRef.current

    if (!viewport) {
      return
    }

    viewport.scrollTop = viewport.scrollHeight
  }, [displayedMessages])

  const replaceLocalMessage = (
    messageId: string,
    updater: (message: AiChatMessage) => AiChatMessage,
  ) => {
    setLocalMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId ? updater(message) : message,
      ),
    )
  }

  const refreshPersistedConversation = async () => {
    await Promise.allSettled([
      conversationQuery.refetch(),
      queryClient.invalidateQueries({
        queryKey: aiChatQueryKeys.conversations(),
      }),
    ])
  }

  const handleStopStreaming = () => {
    activeAbortControllerRef.current?.abort()
  }

  const handleSendMessage = async () => {
    if (!conversation || isStreaming) {
      return
    }

    const text = draft.trim()

    if (!text) {
      return
    }

    const now = new Date().toISOString()
    const clientMessageId = crypto.randomUUID()
    const userMessageId = `local-user-${clientMessageId}`
    const assistantMessageId = `local-assistant-${clientMessageId}`
    const abortController = new AbortController()

    setDraft("")
    setSendError(null)
    setIsStreaming(true)
    activeAbortControllerRef.current = abortController
    setLocalMessages([
      {
        id: userMessageId,
        conversationId,
        role: "user",
        content: text,
        status: "complete",
        model: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        clientMessageId,
      },
      {
        id: assistantMessageId,
        conversationId,
        role: "assistant",
        content: "",
        status: "streaming",
        model: conversation.model,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      },
    ])

    try {
      const streamResult = await streamMessageMutation.mutateAsync({
        conversationId,
        text,
        modelProfile: selectedProfile,
        clientMessageId,
        signal: abortController.signal,
      })
      const reader = streamResult.text.getReader()
      let assistantText = ""

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        assistantText += value
        replaceLocalMessage(assistantMessageId, (message) => ({
          ...message,
          content: assistantText,
          updatedAt: new Date().toISOString(),
        }))
      }

      replaceLocalMessage(assistantMessageId, (message) => ({
        ...message,
        content: assistantText,
        status: "complete",
        updatedAt: new Date().toISOString(),
      }))
      await refreshPersistedConversation()
      setLocalMessages([])
    } catch (error) {
      const nextError = getSendErrorMessage(error)
      const wasAborted = abortController.signal.aborted

      replaceLocalMessage(assistantMessageId, (message) => ({
        ...message,
        status: wasAborted ? "cancelled" : "failed",
        errorMessage: wasAborted ? null : nextError,
        updatedAt: new Date().toISOString(),
      }))

      if (nextError) {
        setSendError(nextError)
      }

      await refreshPersistedConversation()
      setLocalMessages([])
    } finally {
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null
      }

      setIsStreaming(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border border-zinc-800 bg-zinc-950/70 sm:rounded-3xl">
      <header className="shrink-0 border-b border-orange-500/10 bg-black/35 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/ai"
              prefetch={false}
              className="text-xs font-semibold uppercase tracking-[0.26em] text-orange-300 transition-colors hover:text-orange-100"
            >
              AI Chat
            </Link>
            <h1 className="mt-2 truncate text-lg font-semibold text-white">
              {conversation?.title ?? "AI Conversation"}
            </h1>
          </div>
          {conversation ? (
            <div className="shrink-0 rounded-full border border-orange-400/25 bg-orange-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-200">
              {profileLabels[conversation.model.profile]}
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_50%_0%,rgba(251,146,60,0.08),transparent_34%),linear-gradient(180deg,rgba(251,146,60,0.035),transparent_44%)]">
        <div
          ref={messageViewportRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
          aria-busy={conversationQuery.isPending}
        >
          {conversationQuery.isPending ? (
            <MessageSkeleton />
          ) : conversationQuery.isError ? (
            <div
              role="alert"
              className="mx-auto mt-12 max-w-lg rounded-3xl border border-red-900/70 bg-red-950/30 px-5 py-5 text-sm text-red-100"
            >
              <p>{getConversationErrorMessage(conversationQuery.error)}</p>
              <button
                type="button"
                onClick={() => void conversationQuery.refetch()}
                className="mt-4 rounded-full border border-red-700/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-100 transition-colors hover:border-red-300"
              >
                Retry
              </button>
            </div>
          ) : conversation && displayedMessages.length === 0 ? (
            <div className="mx-auto mt-12 max-w-lg rounded-3xl border border-dashed border-orange-500/25 bg-black/25 px-5 py-8 text-center">
              <p className="text-sm font-medium text-white">New AI chat</p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                This thread is ready for its first message.
              </p>
            </div>
          ) : conversation ? (
            <div className="space-y-4">
              {conversation.hasMoreHistory ? (
                <div className="mx-auto w-fit rounded-full border border-zinc-800 bg-black/30 px-4 py-2 text-xs font-medium text-zinc-500">
                  Older messages are available
                </div>
              ) : null}
              {displayedMessages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-zinc-800/80 bg-black/45 px-4 py-3 sm:px-5">
          {sendError ? (
            <div
              role="alert"
              className="mb-3 rounded-2xl border border-red-900/70 bg-red-950/35 px-4 py-3 text-sm text-red-100"
            >
              {sendError}
            </div>
          ) : null}

          <form
            className="flex items-end gap-3 rounded-3xl border border-zinc-800/80 bg-zinc-950/75 p-2"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSendMessage()
            }}
          >
            <textarea
              rows={1}
              value={draft}
              disabled={!conversation || isStreaming || conversationQuery.isError}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void handleSendMessage()
                }
              }}
              placeholder="Message AI"
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopStreaming}
                className="h-11 shrink-0 rounded-full border border-zinc-700 px-5 text-sm font-semibold text-zinc-200 transition-colors hover:border-orange-300 hover:text-white"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={
                  !conversation ||
                  conversationQuery.isError ||
                  draft.trim().length === 0
                }
                className="h-11 shrink-0 rounded-full bg-orange-400 px-5 text-sm font-semibold text-black transition-colors hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Send
              </button>
            )}
          </form>
        </footer>
      </div>
    </section>
  )
}
