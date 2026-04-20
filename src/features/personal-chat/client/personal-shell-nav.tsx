"use client"

import Link from "next/link"
import type { PersonalSession } from "@/features/personal-chat/domain"
import { PersonalProfileMenu } from "./personal-profile-menu"

export function PersonalShellNav({ session }: { session: PersonalSession }) {
  return (
    <nav className="flex items-center gap-3">
      <Link
        href="/"
        prefetch={false}
        className="rounded-full border border-zinc-800 bg-black/20 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
      >
        Chooser
      </Link>

      <Link
        href="/private"
        prefetch={false}
        className="rounded-full border border-zinc-800 bg-black/20 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
      >
        Privacy chat
      </Link>

      <PersonalProfileMenu session={session} />
    </nav>
  )
}
