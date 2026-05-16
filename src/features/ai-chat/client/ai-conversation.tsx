"use client"

import Link from "next/link"
import type {
  AiChatMessage,
  AiMessageRole,
  AiMessageStatus,
  AiModelProfile,
} from "@/features/ai-chat/domain"
import { AiChatApiError } from "./ai-chat-api"
import { useAiConversationDetailQuery } from "./hooks"

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
  const conversationQuery = useAiConversationDetailQuery(conversationId, {
    limit: MESSAGE_PAGE_SIZE,
  })
  const conversation = conversationQuery.data

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
          ) : conversation && conversation.messages.length === 0 ? (
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
              {conversation.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-zinc-800/80 bg-black/45 px-4 py-3 sm:px-5">
          <div className="flex items-end gap-3 rounded-3xl border border-zinc-800/80 bg-zinc-950/75 p-2">
            <textarea
              disabled
              rows={1}
              placeholder="Message AI"
              className="min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              disabled
              className="h-11 shrink-0 rounded-full bg-orange-400 px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45"
            >
              Send
            </button>
          </div>
        </footer>
      </div>
    </section>
  )
}
