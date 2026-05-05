"use client"

import Link from "next/link"
import type { PersonalSession, SessionUser } from "@/features/personal-chat/domain"
import { personalInboxPath } from "@/features/personal-chat/route-guard-paths"
import { PersonalProfileMenu } from "./personal-profile-menu"

export function PersonalConversationHeader({
  participant,
  session,
  realtimeStatusError,
}: {
  participant: SessionUser
  session: PersonalSession
  realtimeStatusError: string | null
}) {
  return (
    <div className="border-b border-zinc-800 bg-black/15 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {participant.displayName}
          </h2>
          <p className="mt-1 truncate text-sm text-zinc-500">
            @{participant.handle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={personalInboxPath}
            prefetch={false}
            className="rounded-full border border-zinc-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-sky-400 hover:text-white"
          >
            <span className="hidden sm:inline">Back to Inbox</span>
            <span className="sm:hidden">Back</span>
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
