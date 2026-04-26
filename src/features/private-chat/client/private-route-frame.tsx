"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { PrivateShellNav } from "./private-shell-nav"

const isPrivateRoomRoute = (pathname: string | null) =>
  pathname?.startsWith("/private/room/") ?? false

export function PrivateRouteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isRoomRoute = isPrivateRoomRoute(pathname)

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_35%),linear-gradient(180deg,_#05070a_0%,_#090d12_100%)] text-zinc-100">
      {isRoomRoute ? null : (
        <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-[#09110f]/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
            <div className="min-w-0">
              <Link
                href="/private"
                prefetch={false}
                className="text-lg font-semibold text-white transition-colors hover:text-green-300"
              >
                Privacy chat
              </Link>
              <p className="mt-1 text-xs uppercase tracking-[0.28em] text-green-400">
                Secure rooms
              </p>
            </div>

            <PrivateShellNav />
          </div>
        </header>
      )}

      <div
        className={
          isRoomRoute
            ? "flex min-h-0 flex-1 flex-col"
            : "mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8"
        }
      >
        {children}
      </div>
    </div>
  )
}
