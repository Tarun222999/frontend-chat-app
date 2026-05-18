"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import type { PersonalSession } from "@/features/personal-chat/domain"
import { PersonalShellNav } from "./personal-shell-nav"

const isConversationRoute = (pathname: string | null) =>
  pathname?.startsWith("/personal/chat/") ?? false

const isLoginRoute = (pathname: string | null) => pathname === "/personal/login"

export function PersonalRouteFrame({
  children,
  session,
}: {
  children: ReactNode
  session: PersonalSession
}) {
  const pathname = usePathname()
  const hideShellHeader = isConversationRoute(pathname)
  const showPulseAuthShell = isLoginRoute(pathname)

  return (
    <div
      className={
        hideShellHeader
          ? "flex h-[100dvh] flex-col overflow-hidden bg-[linear-gradient(180deg,_#071018_0%,_#0a0d11_100%)] text-zinc-100"
          : showPulseAuthShell
            ? "flex min-h-screen flex-col bg-[radial-gradient(circle_at_18%_12%,rgba(56,189,248,0.1),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.08),transparent_30%),radial-gradient(circle_at_60%_88%,rgba(245,158,11,0.08),transparent_32%),linear-gradient(180deg,_#060708_0%,_#0a0b0d_100%)] text-zinc-100"
            : "flex min-h-screen flex-col bg-[linear-gradient(180deg,_#071018_0%,_#0a0d11_100%)] text-zinc-100"
      }
    >
      {hideShellHeader ? null : (
        <header
          className={
            showPulseAuthShell
              ? "sticky top-0 z-20 border-b border-zinc-800/60 bg-black/35 backdrop-blur"
              : "sticky top-0 z-20 border-b border-zinc-800/80 bg-[#091118]/90 backdrop-blur"
          }
        >
          <div className="mx-auto flex w-full max-w-7xl items-start justify-between gap-4 px-4 py-4 sm:items-center">
            <div className="min-w-0">
              <Link
                href={session.isAuthenticated ? "/personal" : "/personal/login"}
                prefetch={false}
                className={
                  showPulseAuthShell
                    ? "text-base font-semibold uppercase tracking-[0.28em] text-white transition-colors hover:text-zinc-200 sm:text-lg"
                    : "text-base font-semibold text-white transition-colors hover:text-sky-200 sm:text-lg"
                }
              >
                {showPulseAuthShell ? "PULSE" : "Personal Chat"}
              </Link>
            </div>

            {showPulseAuthShell ? null : <PersonalShellNav session={session} />}
          </div>
        </header>
      )}

      <main
        className={
          hideShellHeader
            ? "mx-auto flex min-h-0 w-full max-w-[120rem] flex-1 flex-col overflow-hidden px-0 py-0 sm:px-4 sm:py-4"
            : showPulseAuthShell
              ? "mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:py-8"
              : "mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8"
        }
      >
        {children}
      </main>
    </div>
  )
}
