"use client"

import Link from "next/link"
import { useState } from "react"
import {
  personalInboxPath,
  personalLoginPath,
} from "@/features/personal-chat/route-guard-paths"
import { usePersonalSessionQuery } from "@/features/personal-chat/client/hooks"

const navLinkClassName =
  "text-sm font-medium text-zinc-300 transition-colors hover:text-white"

const mobileNavLinkClassName =
  "block border-b border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors last:border-b-0 hover:bg-green-500/10 hover:text-green-300"

export function PrivateShellNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const sessionQuery = usePersonalSessionQuery()
  const isPersonalSessionActive = sessionQuery.data?.isAuthenticated === true
  const personalNavHref = isPersonalSessionActive
    ? personalInboxPath
    : personalLoginPath
  const personalNavLabel = isPersonalSessionActive
    ? "Personal Chat"
    : "Personal Login"

  return (
    <nav aria-label="Private chat" className="relative">
      <div className="hidden items-center gap-3 sm:flex">
        <Link href="/" prefetch={false} className={navLinkClassName}>
          Choose Space
        </Link>

        <span aria-hidden="true" className="text-zinc-600">
          &bull;
        </span>

        <Link
          href={personalNavHref}
          prefetch={false}
          className={navLinkClassName}
        >
          {personalNavLabel}
        </Link>
      </div>

      <button
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((current) => !current)}
        className="flex h-10 w-10 items-center justify-center border border-zinc-700 bg-zinc-950/70 text-zinc-100 transition-colors hover:border-green-500 hover:text-green-300 sm:hidden"
      >
        <span className="space-y-1.5" aria-hidden="true">
          <span className="block h-0.5 w-4 bg-current" />
          <span className="block h-0.5 w-4 bg-current" />
          <span className="block h-0.5 w-4 bg-current" />
        </span>
      </button>

      {isMenuOpen ? (
        <div className="absolute right-0 top-12 z-30 w-48 overflow-hidden border border-zinc-700 bg-zinc-950/95 shadow-[0_18px_60px_rgba(0,0,0,0.38)] backdrop-blur sm:hidden">
          <Link
            href="/"
            prefetch={false}
            className={mobileNavLinkClassName}
            onClick={() => setIsMenuOpen(false)}
          >
            Choose Space
          </Link>

          <Link
            href={personalNavHref}
            prefetch={false}
            className={mobileNavLinkClassName}
            onClick={() => setIsMenuOpen(false)}
          >
            {personalNavLabel}
          </Link>
        </div>
      ) : null}
    </nav>
  )
}
