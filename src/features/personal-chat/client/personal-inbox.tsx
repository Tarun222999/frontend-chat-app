"use client"

import { startTransition, useDeferredValue, useState } from "react"
import { useRouter } from "next/navigation"
import type { ConversationSummary, DmCandidate } from "@/features/personal-chat/domain"
import { PersonalChatApiError } from "./personal-chat-api"
import {
  useConversationSummariesQuery,
  useDmCandidatesQuery,
  useOpenDirectConversationMutation,
  usePersonalSessionQuery,
  usePersonalUserSearchQuery,
} from "./hooks"

const SEARCH_TRIGGER_LENGTH = 3

const sameDayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
})

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "PC"

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

const getConversationPreview = (conversation: ConversationSummary) => {
  const preview = conversation.lastMessagePreview

  if (!preview) {
    return "No messages yet. Start the conversation."
  }

  if (
    preview.toLowerCase().includes("secure room") ||
    preview.includes("/private/room/")
  ) {
    return "Shared a Secure Room"
  }

  return preview
}

const getInboxActionErrorMessage = (error: unknown) => {
  if (error instanceof PersonalChatApiError) {
    if (error.status === 401) {
      return "Your session expired. Sign in again to continue personal chat."
    }

    return error.message || "We couldn't complete that inbox action."
  }

  return "We couldn't complete that inbox action."
}

const getSearchErrorMessage = (error: unknown) => {
  if (error instanceof PersonalChatApiError) {
    if (error.status === 401) {
      return "Your session expired. Sign in again to search people."
    }

    return error.message || "We couldn't search people right now."
  }

  return "We couldn't search people right now."
}

const matchesConversationSearch = (
  conversation: ConversationSummary,
  normalizedQuery: string,
) => {
  const searchValue = [
    conversation.participant.displayName,
    conversation.participant.handle,
    conversation.lastMessagePreview ?? "",
  ]
    .join(" ")
    .toLowerCase()

  return searchValue.includes(normalizedQuery)
}

function AvatarBadge({
  label,
  size = "md",
}: {
  label: string
  size?: "sm" | "md"
}) {
  const dimensionClass =
    size === "sm" ? "h-11 w-11 text-xs" : "h-14 w-14 text-sm"

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-sky-400/25 bg-sky-400/10 font-semibold text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.06)] ${dimensionClass}`}
    >
      {label}
    </div>
  )
}

function ConversationRow({
  conversation,
  onOpen,
}: {
  conversation: ConversationSummary
  onOpen: (conversationId: string) => void
}) {
  const timestamp = formatConversationTimestamp(conversation.lastMessageAt)
  const preview = getConversationPreview(conversation)

  return (
    <button
      type="button"
      onClick={() => onOpen(conversation.id)}
      className="group relative flex w-full items-center gap-4 rounded-2xl border border-zinc-800/70 bg-black/15 px-4 py-4 text-left transition-[background-color,border-color,box-shadow] duration-200 hover:border-sky-400/55 hover:bg-sky-400/[0.045] hover:shadow-[0_18px_50px_rgba(56,189,248,0.07)]"
    >
      <span
        aria-hidden="true"
        className="absolute bottom-4 left-0 top-4 w-px bg-sky-400/0 transition-colors group-hover:bg-sky-400/70"
      />
      <AvatarBadge label={getInitials(conversation.participant.displayName)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {conversation.participant.displayName}
            </p>
            <p className="mt-1 truncate text-xs text-zinc-500">
              @{conversation.participant.handle}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {timestamp ? (
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                {timestamp}
              </p>
            ) : null}
            {conversation.unreadCount > 0 ? (
              <span className="mt-2 inline-flex min-w-6 items-center justify-center rounded-full bg-sky-400 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
                {conversation.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-3 truncate text-sm text-zinc-400">
          {preview}
        </p>
      </div>
    </button>
  )
}

function CandidateRow({
  candidate,
  isOpening,
  onOpen,
}: {
  candidate: DmCandidate
  isOpening: boolean
  onOpen: (candidate: DmCandidate) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(candidate)}
      disabled={isOpening}
      className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800/70 bg-black/15 px-4 py-4 text-left transition-[background-color,border-color,box-shadow] duration-200 hover:border-sky-400/55 hover:bg-sky-400/[0.045] hover:shadow-[0_18px_50px_rgba(56,189,248,0.07)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <AvatarBadge label={getInitials(candidate.displayName)} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {candidate.displayName}
            </p>
            <p className="mt-1 truncate text-xs text-zinc-500">
              @{candidate.handle}
            </p>
          </div>
          {isOpening ? (
            <span className="text-[11px] uppercase tracking-[0.2em] text-sky-300">
              Opening
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/40"
        />
      ))}
    </div>
  )
}

export function PersonalInbox() {
  const router = useRouter()
  const sessionQuery = usePersonalSessionQuery()
  const dmCandidatesQuery = useDmCandidatesQuery()
  const conversationSummariesQuery = useConversationSummariesQuery()
  const openDirectConversationMutation = useOpenDirectConversationMutation()
  const [actionError, setActionError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeMobilePane, setActiveMobilePane] = useState<
    "people" | "conversations"
  >("conversations")
  const [openingParticipantId, setOpeningParticipantId] = useState<string | null>(
    null,
  )
  const deferredSearchQuery = useDeferredValue(searchQuery.trim())
  const searchUsersQuery = usePersonalUserSearchQuery({
    query: deferredSearchQuery,
    limit: 8,
  })

  const dmCandidates = dmCandidatesQuery.data ?? []
  const conversations = conversationSummariesQuery.data ?? []
  const searchResults = searchUsersQuery.data ?? []
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const isSearchingUsers = deferredSearchQuery.length >= SEARCH_TRIGGER_LENGTH

  const filteredConversations =
    normalizedSearchQuery.length === 0
      ? conversations
      : conversations.filter((conversation) =>
          matchesConversationSearch(conversation, normalizedSearchQuery),
        )

  const handleRetryInbox = async () => {
    setActionError(null)

    const refetchTasks = [
      sessionQuery.refetch(),
      dmCandidatesQuery.refetch(),
      conversationSummariesQuery.refetch(),
    ]

    if (isSearchingUsers) {
      refetchTasks.push(searchUsersQuery.refetch())
    }

    await Promise.allSettled(refetchTasks)
  }

  const navigateToConversation = (conversationId: string) => {
    startTransition(() => {
      router.push(`/personal/chat/${encodeURIComponent(conversationId)}`)
    })
  }

  const handleOpenCandidate = async (candidate: DmCandidate) => {
    setActionError(null)
    setOpeningParticipantId(candidate.id)

    try {
      const conversation = await openDirectConversationMutation.mutateAsync({
        participantId: candidate.id,
      })

      navigateToConversation(conversation.id)
    } catch (error) {
      setActionError(getInboxActionErrorMessage(error))
    } finally {
      setOpeningParticipantId(null)
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

      <div className="grid grid-cols-2 border border-zinc-800 bg-black/20 p-1 xl:hidden">
        <button
          type="button"
          onClick={() => setActiveMobilePane("conversations")}
          className={`px-3 py-2 text-sm font-semibold transition-colors ${
            activeMobilePane === "conversations"
              ? "bg-sky-400/15 text-sky-100 ring-1 ring-sky-400/40"
              : "text-zinc-500"
          }`}
        >
          Conversations
        </button>
        <button
          type="button"
          onClick={() => setActiveMobilePane("people")}
          className={`px-3 py-2 text-sm font-semibold transition-colors ${
            activeMobilePane === "people"
              ? "bg-sky-400/15 text-sky-100 ring-1 ring-sky-400/40"
              : "text-zinc-500"
          }`}
        >
          People
        </button>
      </div>

      <section
        className={`overflow-hidden rounded-[1.75rem] border border-zinc-800/75 bg-zinc-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.18)] ${
          activeMobilePane === "people" ? "block" : "hidden xl:block"
        }`}
      >
        <div className="border-b border-zinc-800/60 p-5">
          <h3 className="text-lg font-semibold text-white">Find People</h3>
          <input
            id="personal-inbox-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search people"
            className="mt-4 w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-sky-400"
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              Find anyone by username.
            </p>
            <button
              type="button"
              onClick={() => void handleRetryInbox()}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-zinc-300 transition-colors hover:border-sky-400 hover:text-white"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-4">
          {normalizedSearchQuery.length > 0 ? (
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                  Results
                </p>
                {isSearchingUsers ? (
                  <span className="text-[11px] uppercase tracking-[0.2em] text-sky-300">
                    Search
                  </span>
                ) : null}
              </div>

              {deferredSearchQuery.length < SEARCH_TRIGGER_LENGTH ? (
                <div className="rounded-3xl border border-dashed border-zinc-800 bg-black/20 px-4 py-5 text-sm text-zinc-400">
                  Enter at least {SEARCH_TRIGGER_LENGTH} characters to find
                  people.
                </div>
              ) : searchUsersQuery.isPending ? (
                <ListSkeleton rows={3} />
              ) : searchUsersQuery.isError ? (
                <div className="rounded-3xl border border-red-900/70 bg-red-950/30 px-4 py-5 text-sm text-red-100">
                  {getSearchErrorMessage(searchUsersQuery.error)}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-zinc-800 bg-black/20 px-4 py-5 text-sm text-zinc-400">
                  No people matched &quot;{deferredSearchQuery}&quot;.
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((candidate) => (
                    <CandidateRow
                      key={candidate.id}
                      candidate={candidate}
                      isOpening={openingParticipantId === candidate.id}
                      onOpen={(nextCandidate) => {
                        void handleOpenCandidate(nextCandidate)
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                People
              </p>
              <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                {dmCandidates.length}
              </span>
            </div>

            <div aria-busy={dmCandidatesQuery.isPending}>
              {dmCandidatesQuery.isPending ? (
                <ListSkeleton rows={4} />
              ) : dmCandidatesQuery.isError ? (
                <div className="rounded-3xl border border-red-900/70 bg-red-950/30 px-4 py-5 text-sm text-red-100">
                  We couldn&apos;t load your quick-start contacts yet.
                </div>
              ) : dmCandidates.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-zinc-800 bg-black/20 px-4 py-5 text-sm text-zinc-400">
                  No quick-start contacts are available right now.
                </div>
              ) : (
                <div className="space-y-2">
                  {dmCandidates.map((candidate) => (
                    <CandidateRow
                      key={candidate.id}
                      candidate={candidate}
                      isOpening={openingParticipantId === candidate.id}
                      onOpen={(nextCandidate) => {
                        void handleOpenCandidate(nextCandidate)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      <section
        className={`overflow-hidden rounded-[1.75rem] border border-zinc-800/75 bg-zinc-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.18)] ${
          activeMobilePane === "conversations" ? "block" : "hidden xl:block"
        }`}
      >
        <div className="border-b border-zinc-800/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">Conversations</h3>
            <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              {filteredConversations.length}
            </span>
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            Continue where you left off.
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4" aria-busy={conversationSummariesQuery.isPending}>
          {conversationSummariesQuery.isPending ? (
            <ListSkeleton rows={6} />
          ) : conversationSummariesQuery.isError ? (
            <div className="rounded-3xl border border-red-900/70 bg-red-950/30 px-4 py-5 text-sm text-red-100">
              We couldn&apos;t load your conversations yet. Use refresh to try
              again.
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-800 bg-black/20 px-4 py-5">
              <p className="text-sm font-medium text-white">
                {conversations.length === 0
                  ? "No conversations yet"
                  : "No conversations matched your search"}
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                {conversations.length === 0
                  ? "Find someone from People to create your first chat."
                  : "Try a different name, handle, or message keyword."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  onOpen={navigateToConversation}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </section>
  )
}
