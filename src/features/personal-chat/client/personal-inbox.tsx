"use client"

import Link from "next/link"
import { startTransition, useState } from "react"
import { useRouter } from "next/navigation"
import type {
  ConversationSummary,
  DmCandidate,
  PersonalSession,
} from "@/features/personal-chat/domain"
import { personalLoginPath } from "@/features/personal-chat/route-guard-paths"
import { PersonalChatApiError } from "./personal-chat-api"
import {
  useConversationSummariesQuery,
  useDmCandidatesQuery,
  useOpenDirectConversationMutation,
  usePersonalLogoutMutation,
  usePersonalSessionQuery,
} from "./hooks"

const inboxTabs = [
  {
    label: "Messages",
    isActive: true,
  },
  {
    label: "Secure Vault",
    isActive: false,
  },
  {
    label: "Terminals",
    isActive: false,
  },
  {
    label: "Settings",
    isActive: false,
  },
] as const

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
    return "Waiting"
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

const getConversationPreview = (conversation: ConversationSummary) =>
  conversation.lastMessagePreview ?? "No messages yet. Start the conversation."

const getSessionTitle = (session: PersonalSession | undefined) => {
  if (!session?.isAuthenticated || !session.user) {
    return "Syncing personal inbox"
  }

  return session.user.displayName
}

const getSessionSubtitle = (session: PersonalSession | undefined) => {
  if (!session?.isAuthenticated || !session.user) {
    return "Refreshing your personal session."
  }

  return `@${session.user.handle}`
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

function AvatarBadge({
  label,
  isAvailable,
}: {
  label: string
  isAvailable?: boolean
}) {
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-sm font-semibold text-cyan-100">
      {label}
      {typeof isAvailable === "boolean" ? (
        <span
          className={`absolute right-1 bottom-1 h-2.5 w-2.5 rounded-full border border-zinc-950 ${isAvailable ? "bg-emerald-400" : "bg-zinc-600"
            }`}
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}

function CandidateCard({
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
      className="group min-w-[220px] rounded-3xl border border-zinc-800 bg-black/25 p-4 text-left transition-colors hover:border-cyan-400/70 hover:bg-cyan-400/5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex items-start gap-3">
        <AvatarBadge
          label={getInitials(candidate.displayName)}
          isAvailable={candidate.isAvailable}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">
              {candidate.displayName}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] ${candidate.isAvailable
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-zinc-800 text-zinc-400"
                }`}
            >
              {candidate.isAvailable ? "Online" : "Idle"}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-zinc-500">
            @{candidate.handle}
          </p>
          <p className="mt-4 text-xs uppercase tracking-[0.25em] text-cyan-400 transition-colors group-hover:text-cyan-200">
            {isOpening ? "Opening..." : "Open direct message"}
          </p>
        </div>
      </div>
    </button>
  )
}

function ConversationRow({
  conversation,
  onOpen,
}: {
  conversation: ConversationSummary
  onOpen: (conversationId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(conversation.id)}
      className="flex w-full items-center gap-4 rounded-3xl border border-zinc-800 bg-black/20 px-4 py-4 text-left transition-colors hover:border-cyan-400/60 hover:bg-cyan-400/5"
    >
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
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              {formatConversationTimestamp(conversation.lastMessageAt)}
            </p>
            {conversation.unreadCount > 0 ? (
              <span className="mt-2 inline-flex min-w-6 items-center justify-center rounded-full bg-cyan-400 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
                {conversation.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-3 truncate text-sm text-zinc-400">
          {getConversationPreview(conversation)}
        </p>
      </div>
    </button>
  )
}

function InboxSectionSkeleton({
  rows,
  wide = false,
}: {
  rows: number
  wide?: boolean
}) {
  return (
    <div className={`grid gap-3 ${wide ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={`animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/40 ${wide ? "h-28" : "h-24"
            }`}
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
  const logoutMutation = usePersonalLogoutMutation()
  const [openingParticipantId, setOpeningParticipantId] = useState<string | null>(
    null,
  )
  const [actionError, setActionError] = useState<string | null>(null)

  const session = sessionQuery.data
  const dmCandidates = dmCandidatesQuery.data ?? []
  const conversations = conversationSummariesQuery.data ?? []

  const handleRetryInbox = async () => {
    setActionError(null)
    await Promise.allSettled([
      sessionQuery.refetch(),
      dmCandidatesQuery.refetch(),
      conversationSummariesQuery.refetch(),
    ])
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

  const handleLogout = async () => {
    setActionError(null)

    try {
      await logoutMutation.mutateAsync()

      startTransition(() => {
        router.replace(personalLoginPath)
      })
    } catch (error) {
      setActionError(getInboxActionErrorMessage(error))
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-6 xl:sticky xl:top-24 xl:self-start">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
            Personal inbox
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            {getSessionTitle(session)}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            {getSessionSubtitle(session)}
          </p>
          <p className="mt-5 text-sm leading-7 text-zinc-400">
            Open an existing DM, start a new one from the candidate strip, or
            hand off to a secure room from the next conversation step.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
            </button>
            <Link
              href="/"
              prefetch={false}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
            >
              Back to Chooser
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-black/30 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Workspace
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {inboxTabs.map((tab) => (
              <span
                key={tab.label}
                className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.2em] ${tab.isActive
                    ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                    : "border-zinc-800 text-zinc-500"
                  }`}
              >
                {tab.label}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            Messages is live in this step. The other spaces stay visible here as
            placeholders so the final personal shell has a stable shape.
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-black/20 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Snapshot
          </p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                DM candidates
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-white">
                {dmCandidates.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Conversations
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-white">
                {conversations.length}
              </dd>
            </div>
          </dl>
        </div>
      </aside>

      <div className="min-w-0 space-y-6">
        {actionError ? (
          <div
            role="alert"
            className="rounded-3xl border border-red-900/80 bg-red-950/40 px-5 py-4 text-sm text-red-100"
          >
            {actionError}
          </div>
        ) : null}

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
                DM candidates
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                Start a direct message
              </h3>
            </div>
            <button
              type="button"
              onClick={() => void handleRetryInbox()}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-zinc-300 transition-colors hover:border-cyan-400 hover:text-white"
            >
              Refresh inbox
            </button>
          </div>

          <p className="mt-4 text-sm leading-7 text-zinc-400">
            These contacts come from the personal-chat DM candidate list and open
            or create a one-to-one conversation when selected.
          </p>

          <div className="mt-6" aria-busy={dmCandidatesQuery.isPending}>
            {dmCandidatesQuery.isPending ? (
              <InboxSectionSkeleton rows={3} wide />
            ) : dmCandidatesQuery.isError ? (
              <div className="rounded-3xl border border-red-900/70 bg-red-950/30 px-5 py-4 text-sm text-red-100">
                We couldn&apos;t load DM candidates yet. Use refresh to try again.
              </div>
            ) : dmCandidates.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-800 bg-black/20 px-5 py-8 text-sm text-zinc-400">
                No direct-message candidates are available right now.
              </div>
            ) : (
              <div className="scrollbar-subtle flex max-w-full snap-x gap-4 overflow-x-auto pb-2">
                {dmCandidates.map((candidate) => (
                  <CandidateCard
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

        <section className="rounded-3xl border border-zinc-800 bg-black/30 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                History
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                Recent conversations
              </h3>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              {conversations.length} thread{conversations.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="mt-6 space-y-3" aria-busy={conversationSummariesQuery.isPending}>
            {conversationSummariesQuery.isPending ? (
              <InboxSectionSkeleton rows={4} />
            ) : conversationSummariesQuery.isError ? (
              <div className="rounded-3xl border border-red-900/70 bg-red-950/30 px-5 py-4 text-sm text-red-100">
                We couldn&apos;t load the conversation history yet. Use refresh to
                try again.
              </div>
            ) : conversations.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/40 px-5 py-8">
                <p className="text-sm font-medium text-white">
                  No conversations yet
                </p>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Pick someone from the candidate strip above and we&apos;ll create
                  the first personal thread.
                </p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  onOpen={navigateToConversation}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
