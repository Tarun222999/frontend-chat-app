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
    title: "Break down a product idea",
    prompt:
      "Help me turn this product idea into scope, risks, user value, and a practical build order.",
  },
  {
    title: "Review this UI decision",
    prompt:
      "Review this UI decision like a product designer. Call out what works, what feels heavy, and what to simplify.",
  },
  {
    title: "Debug backend architecture",
    prompt:
      "Help me debug this backend architecture. Start by mapping the flow, then identify likely failure points.",
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
    <div className="space-y-1.5">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/45"
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
  onDelete: (conversation: AiConversationSummary) => void
  onOpen: (conversationId: string) => void
}) {
  const timestamp = formatConversationTimestamp(
    conversation.lastMessageAt ?? conversation.updatedAt,
  )

  return (
    <div className="group relative flex items-center rounded-xl border border-zinc-800/70 bg-black/20 transition-[background-color,border-color] duration-200 hover:border-amber-600/45 hover:bg-amber-500/[0.035]">
      <span
        aria-hidden="true"
        className="absolute bottom-3 left-0 top-3 w-px bg-amber-500/0 transition-colors group-hover:bg-amber-500/55"
      />
      <button
        type="button"
        onClick={() => onOpen(conversation.id)}
        className="min-w-0 flex-1 px-3 py-3 text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {conversation.title}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {profileLabels[conversation.model.profile]}
            </p>
          </div>
          {timestamp ? (
            <p className="shrink-0 text-xs text-zinc-600">
              {timestamp}
            </p>
          ) : null}
        </div>
      </button>
      <button
        type="button"
        disabled={isDeleting}
        onClick={() => onDelete(conversation)}
        className="mr-2 h-8 w-8 shrink-0 rounded-lg text-sm text-zinc-600 opacity-0 transition-[background-color,color,opacity] hover:bg-red-500/10 hover:text-red-200 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Delete ${conversation.title}`}
      >
        {isDeleting ? "..." : "x"}
      </button>
    </div>
  )
}

function DeleteConversationDialog({
  conversation,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  conversation: AiConversationSummary
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-4 py-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-delete-title"
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.48)]"
      >
        <p
          id="ai-delete-title"
          className="text-sm font-semibold text-white"
        >
          Delete AI chat?
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          This removes <span className="text-zinc-200">{conversation.title}</span>{" "}
          from your saved threads.
        </p>
        <div className="mt-4 grid gap-2 sm:flex sm:justify-end">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="h-10 rounded-full border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="h-10 rounded-full bg-red-500/15 px-4 text-sm font-semibold text-red-100 ring-1 ring-red-500/35 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting" : "Delete"}
          </button>
        </div>
      </div>
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
  const [pendingDeleteConversation, setPendingDeleteConversation] =
    useState<AiConversationSummary | null>(null)

  const conversations = conversationSummariesQuery.data ?? []
  const isCreatingBlank =
    createConversationMutation.isPending && startingPrompt === null

  const navigateToConversation = (conversationId: string) => {
    startTransition(() => {
      router.push(`/ai/chat/${encodeURIComponent(conversationId)}`)
    })
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

  const handleStartFromPrompt = async (starter: (typeof starterPrompts)[number]) => {
    setActionError(null)
    setStartingPrompt(starter.prompt)

    try {
      const conversation = await createConversationMutation.mutateAsync({
        title: starter.title,
        initialMessage: starter.prompt,
        clientMessageId: crypto.randomUUID(),
      })
      navigateToConversation(conversation.id)
    } catch (error) {
      setActionError(getInboxActionErrorMessage(error))
    } finally {
      setStartingPrompt(null)
    }
  }

  const handleConfirmDeleteConversation = async () => {
    if (!pendingDeleteConversation) {
      return
    }

    const conversationId = pendingDeleteConversation.id
    setActionError(null)
    setDeletingConversationId(conversationId)

    try {
      await deleteConversationMutation.mutateAsync(conversationId)
      setPendingDeleteConversation(null)
    } catch (error) {
      setActionError(getInboxActionErrorMessage(error))
    } finally {
      setDeletingConversationId(null)
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6">
      {actionError ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-900/80 bg-red-950/40 px-4 py-3 text-sm text-red-100"
        >
          {actionError}
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-800/75 bg-zinc-950/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.15)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500/80">
              AI Chat
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Start a focused AI chat.
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              A thinking space for product decisions, architecture, and clear writing.
            </p>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              disabled={isCreatingBlank}
              onClick={() => void handleCreateBlankConversation()}
              className="rounded-full bg-amber-600/85 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-500/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingBlank ? "Starting" : "Start new chat"}
            </button>
          </div>
        </div>

        <div className="mt-5 hidden gap-2 md:grid md:grid-cols-3">
          {starterPrompts.map((starter) => (
            <button
              key={starter.title}
              type="button"
              disabled={createConversationMutation.isPending}
              onClick={() => void handleStartFromPrompt(starter)}
              className="min-h-28 rounded-xl border border-zinc-800/80 bg-black/20 p-4 text-left transition-[background-color,border-color] hover:border-amber-600/45 hover:bg-amber-500/[0.035] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-500/75">
                {startingPrompt === starter.prompt ? "Starting" : "Prompt"}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-white">
                {starter.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-500">
                {starter.prompt}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Recent chats
          </h2>
          <span className="text-xs text-zinc-600">{conversations.length}</span>
        </div>

        <div
          className="max-h-[46vh] overflow-y-auto"
          aria-busy={conversationSummariesQuery.isPending}
        >
          {conversationSummariesQuery.isPending ? (
            <ListSkeleton rows={6} />
          ) : conversationSummariesQuery.isError ? (
            <div className="rounded-xl border border-red-900/70 bg-red-950/30 px-4 py-4 text-sm text-red-100">
              We couldn&apos;t load your AI conversations yet.
            </div>
          ) : conversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-black/20 px-4 py-4">
              <p className="text-sm font-medium text-white">
                No recent chats yet
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Start a new AI chat or choose a prompt above.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  isDeleting={deletingConversationId === conversation.id}
                  onDelete={setPendingDeleteConversation}
                  onOpen={navigateToConversation}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {pendingDeleteConversation ? (
        <DeleteConversationDialog
          conversation={pendingDeleteConversation}
          isDeleting={deletingConversationId === pendingDeleteConversation.id}
          onCancel={() => setPendingDeleteConversation(null)}
          onConfirm={() => void handleConfirmDeleteConversation()}
        />
      ) : null}
    </section>
  )
}
