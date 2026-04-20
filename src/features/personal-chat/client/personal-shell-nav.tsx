"use client"

import Link from "next/link"
import { startTransition, useState } from "react"
import { useRouter } from "next/navigation"
import type { PersonalSession } from "@/features/personal-chat/domain"
import { personalLoginPath } from "@/features/personal-chat/route-guard-paths"
import { PersonalChatApiError } from "./personal-chat-api"
import { usePersonalLogoutMutation } from "./hooks"

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "PC"

const getLogoutErrorMessage = (error: unknown) => {
  if (error instanceof PersonalChatApiError) {
    if (error.status === 401) {
      return null
    }

    return error.message || "Unable to sign out right now."
  }

  return "Unable to sign out right now."
}

export function PersonalShellNav({ session }: { session: PersonalSession }) {
  const router = useRouter()
  const logoutMutation = usePersonalLogoutMutation()
  const [menuError, setMenuError] = useState<string | null>(null)
  const user = session.user

  const handleLogout = async () => {
    setMenuError(null)

    try {
      await logoutMutation.mutateAsync()
    } catch (error) {
      const nextError = getLogoutErrorMessage(error)

      if (nextError) {
        setMenuError(nextError)
        return
      }
    }

    startTransition(() => {
      router.replace(personalLoginPath)
    })
  }

  return (
    <nav className="flex items-center gap-3">
      <Link
        href="/private"
        prefetch={false}
        className="rounded-full border border-zinc-800 bg-black/20 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
      >
        Privacy chat
      </Link>

      {session.isAuthenticated && user ? (
        <details className="relative">
          <summary
            aria-label="Open profile menu"
            role="button"
            className="list-none rounded-full border border-zinc-800 bg-zinc-950/80 p-1.5 text-white transition-colors hover:border-cyan-400 [&::-webkit-details-marker]:hidden"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400 font-semibold text-slate-950">
              {getInitials(user.displayName)}
            </span>
          </summary>

          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 w-72 rounded-3xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl shadow-black/50">
            <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3">
              <p className="text-sm font-semibold text-white">{user.displayName}</p>
              <p className="mt-1 text-xs text-zinc-500">@{user.handle}</p>
            </div>

            <div className="mt-2 space-y-1">
              <button
                type="button"
                disabled
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-zinc-500"
              >
                <span>Profile update</span>
                <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-600">
                  Soon
                </span>
              </button>

              <button
                type="button"
                disabled
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-zinc-500"
              >
                <span>Secret vault</span>
                <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-600">
                  Soon
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={logoutMutation.isPending}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-red-200 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>
                  {logoutMutation.isPending ? "Signing out..." : "Logout"}
                </span>
              </button>
            </div>

            {menuError ? (
              <div
                role="alert"
                className="mt-2 rounded-2xl border border-red-900/80 bg-red-950/40 px-4 py-3 text-xs text-red-100"
              >
                {menuError}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </nav>
  )
}
