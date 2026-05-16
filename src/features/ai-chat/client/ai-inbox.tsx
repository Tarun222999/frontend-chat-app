"use client"

import { startTransition, useState } from "react"
import { useRouter } from "next/navigation"
import type {
  AiConversationSummary,
  AiModelProfile,
} from "@/features/ai-chat/domain"
import { AiChatApiError } from "./ai-chat-api"
import {
  useAiConversationSummariesQuery,
  useCreateAiConversationMutation,
  useDeleteAiConversationMutation,
} from "./hooks"

const starterPrompts = [
  {
    title: "Plan a feature",
    prompt:
      "Help me break down a v1 feature into product scope, technical steps, risks, and a build order.",
  },
  {
    title: "Debug a problem",
    prompt:
      "Help me debug this issue step by step. Start by asking for the smallest useful reproduction details.",
  },
  {
    title: "Rewrite clearly",
    prompt:
      "Rewrite this into a concise, friendly message while keeping the meaning intact.",
  },
]

const profileLabels: Record<AiModelProfile, string> = {
  free: "Free",
  fast: "Fast",
  balanced: "Balanced",
}

const sameDayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
})

const formatConversationTimestamp = (value: string | null) => {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Recent"
  }

  const now = new Date()
  const isSameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()

  return isSameDay
    ? sameDayTimeFormatter.format(date)
    : monthDayFormatter.format(date)
}

const getConversationPreview = (conversation: AiConversationSummary) =>
  conversation.lastMessagePreview || "No messages yet. Start with a prompt."

const getInboxActionErrorMessage = (error: unknown) => {
  if (error instanceof AiChatApiError) {
    if (error.status === 401) {
      return "Your session expired. Sign in again to continue AI Chat."
    }

    return error.message || "We couldn't complete that AI Chat action."
  }

  return "We couldn't complete that AI Chat action."
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/45"
        />
      ))}
    </div>
  )
}

function ConversationRow({
  conversation,
  isDeleting,
  onDelete,
  onOpen,
}: {
  conversation: AiConversationSummary
  isDeleting: boolean
  onDelete: (conversationId: string) => void
  onOpen: (conversationId: string) => void
}) {
  const timestamp = formatConversationTimestamp(
    conversation.lastMessageAt ?? conversation.updatedAt,
  )
  const preview = getConversationPreview(conversation)

  return (
    <div className="group relative flex items-stretch overflow-hidden rounded-2xl border border-zinc-800/70 bg-black/20 transition-[background-color,border-color,box-shadow] duration-200 hover:border-orange-400/55 hover:bg-orange-400/[0.045] hover:shadow-[0_18px_50px_rgba(249,115,22,0.07)]">
      <span
        aria-hidden="true"
        className="absolute bottom-4 left-0 top-4 w-px bg-orange-400/0 transition-colors group-hover:bg-orange-400/70"
      />
      <button
        type="button"
        onClick={() => onOpen(conversation.id)}
        className="min-w-0 flex-1 px-4 py-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {conversation.title}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {profileLabels[conversation.model.profile]} profile
            </p>
          </div>
          {timestamp ? (
            <p className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
              {timestamp}
            </p>
          ) : null}
        </div>
        <p className="mt-3 truncate text-sm text-zinc-400">{preview}</p>
      </button>
      <button
        type="button"
        disabled={isDeleting}
        onClick={() => onDelete(conversation.id)}
        className="w-16 shrink-0 border-l border-zinc-800/70 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Delete ${conversation.title}`}
      >
        {isDeleting ? "..." : "Del"}
      </button>
    </div>
  )
}

export function AiInbox() {
  const router = useRouter()
  const conversationSummariesQuery = useAiConversationSummariesQuery()
  const createConversationMutation = useCreateAiConversationMutation()
  const deleteConversationMutation = useDeleteAiConversationMutation()
  const [actionError, setActionError] = useState<string | null>(null)
  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null)
  const [startingPrompt, setStartingPrompt] = useState<string | null>(null)

  const conversations = conversationSummariesQuery.data ?? []
  const isCreatingBlank =
    createConversationMutation.isPending && startingPrompt === null

  const navigateToConversation = (conversationId: string) => {
    startTransition(() => {
      router.push(`/ai/chat/${encodeURIComponent(conversationId)}`)
    })
  }

  const handleRetryInbox = async () => {
    setActionError(null)
    await conversationSummariesQuery.refetch()
  }

  const handleCreateBlankConversation = async () => {
    setActionError(null)
    setStartingPrompt(null)

    try {
      const conversation = await createConversationMutation.mutateAsync({})
      navigateToConversation(conversation.id)
    } catch (error) {
      setActionError(getInboxActionErrorMessage(error))
    }
  }

  const handleStartFromPrompt = async (prompt: string) => {
    setActionError(null)
    setStartingPrompt(prompt)

    try {
      const conversation = await createConversationMutation.mutateAsync({
        initialMessage: prompt,
        clientMessageId: crypto.randomUUID(),
      })
      navigateToConversation(conversation.id)
    } catch (error) {
      setActionError(getInboxActionErrorMessage(error))
    } finally {
      setStartingPrompt(null)
    }
  }

  const handleDeleteConversation = async (conversationId: string) => {
    const shouldDelete = window.confirm(
      "Delete this AI conversation? This removes it from your saved threads.",
    )

    if (!shouldDelete) {
      return
    }

    setActionError(null)
    setDeletingConversationId(conversationId)

    try {
      await deleteConversationMutation.mutateAsync(conversationId)
    } catch (error) {
      setActionError(getInboxActionErrorMessage(error))
    } finally {
      setDeletingConversationId(null)
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      {actionError ? (
        <div
          role="alert"
          className="rounded-[2rem] border border-red-900/80 bg-red-950/40 px-5 py-4 text-sm text-red-100 xl:col-span-2"
        >
          {actionError}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[1.75rem] border border-zinc-800/75 bg-zinc-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="border-b border-zinc-800/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
            AI Chat
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-white">
              Conversations
            </h1>
            <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              {conversations.length}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Saved AI threads, scoped to your account.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              disabled={isCreatingBlank}
              onClick={() => void handleCreateBlankConversation()}
              className="rounded-full bg-orange-400 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingBlank ? "Starting" : "New chat"}
            </button>
            <button
              type="button"
              onClick={() => void handleRetryInbox()}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-orange-400 hover:text-white"
            >
              Refresh
            </button>
          </div>
        </div>

        <div
          className="max-h-[70vh] overflow-y-auto p-4"
          aria-busy={conversationSummariesQuery.isPending}
        >
          {conversationSummariesQuery.isPending ? (
            <ListSkeleton rows={6} />
          ) : conversationSummariesQuery.isError ? (
            <div className="rounded-3xl border border-red-900/70 bg-red-950/30 px-4 py-5 text-sm text-red-100">
              We couldn&apos;t load your AI conversations yet. Use refresh to
              try again.
            </div>
          ) : conversations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-800 bg-black/20 px-4 py-5">
              <p className="text-sm font-medium text-white">
                No AI conversations yet
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Start blank or choose a prompt to create your first saved AI
                thread.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  isDeleting={deletingConversationId === conversation.id}
                  onDelete={(conversationId) => {
                    void handleDeleteConversation(conversationId)
                  }}
                  onOpen={navigateToConversation}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-orange-500/20 bg-black/30 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
        <div className="border-b border-orange-500/15 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
            Start
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white">
            Begin with a blank chat or a practical first prompt.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
            V1 keeps AI separate from personal and private conversations. The
            assistant only sees what you send inside this AI thread.
          </p>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-3 xl:p-6">
          {starterPrompts.map((starter) => (
            <button
              key={starter.title}
              type="button"
              disabled={createConversationMutation.isPending}
              onClick={() => void handleStartFromPrompt(starter.prompt)}
              className="min-h-44 rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-5 text-left transition-[background-color,border-color,box-shadow] hover:border-orange-400/55 hover:bg-orange-400/[0.055] hover:shadow-[0_18px_50px_rgba(249,115,22,0.07)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
                {startingPrompt === starter.prompt ? "Starting" : "Prompt"}
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">
                {starter.title}
              </h3>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-zinc-400">
                {starter.prompt}
              </p>
            </button>
          ))}
        </div>
      </section>
    </section>
  )
}
