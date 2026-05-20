"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { accountLoginPath } from "@/features/auth/route-guard-paths"
import type { AccountSession } from "@/features/auth/server"

const isAiConversationRoute = (pathname: string | null) =>
  pathname?.startsWith("/ai/chat/") ?? false

export function AiRouteFrame({
  children,
  session,
}: {
  children: ReactNode
  session: AccountSession
}) {
  const pathname = usePathname()
  const hideShellHeader = isAiConversationRoute(pathname)

  return (
    <div
      className={
        hideShellHeader
          ? "flex h-[100dvh] flex-col overflow-hidden bg-[linear-gradient(180deg,#080706_0%,#0b0b0b_100%)] text-zinc-100"
          : "flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,rgba(180,83,9,0.1),transparent_34%),linear-gradient(180deg,#080706_0%,#0b0b0b_100%)] text-zinc-100"
      }
    >
      {hideShellHeader ? null : (
        <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-[#090807]/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-start justify-between gap-4 px-4 py-4 sm:items-center">
            <div className="min-w-0">
              <Link
                href={session.isAuthenticated ? "/ai" : accountLoginPath}
                prefetch={false}
                className="text-base font-semibold text-white transition-colors hover:text-amber-200 sm:text-lg"
              >
                AI Chat
              </Link>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-amber-500/70">
                Free &bull; Fast &bull; Balanced
              </p>
            </div>

            <nav className="flex shrink-0 items-center gap-3">
              <Link
                href="/"
                prefetch={false}
                className="hidden text-sm font-medium text-zinc-300 transition-colors hover:text-white sm:inline"
              >
                Choose Space
              </Link>
            </nav>
          </div>
        </header>
      )}

      <main
        className={
          hideShellHeader
            ? "mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-0 py-0 sm:px-3 sm:py-3"
            : "mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8"
        }
      >
        {children}
      </main>
    </div>
  )
}
