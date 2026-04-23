"use client"

import Link from "next/link"
import type { PersonalSession, SessionUser } from "@/features/personal-chat/domain"
import { personalInboxPath } from "@/features/personal-chat/route-guard-paths"
import { PersonalProfileMenu } from "./personal-profile-menu"
import type { RealtimeIndicator } from "./personal-conversation-shared"

export function PersonalConversationHeader({
  participant,
  session,
  realtimeIndicator,
  realtimeStatusError,
}: {
  participant: SessionUser
  session: PersonalSession
  realtimeIndicator: RealtimeIndicator | null
  realtimeStatusError: string | null
}) {
  return (
    <div className="border-b border-zinc-800 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {participant.displayName}
            </h2>
            <p className="truncate text-sm text-zinc-500">@{participant.handle}</p>
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
          <PersonalProfileMenu session={session} compact />
        </div>
      </div>
      {realtimeStatusError ? (
        <p className="mt-2 text-sm text-red-300">{realtimeStatusError}</p>
      ) : null}
    </div>
  )
}
