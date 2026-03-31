"use client"

import { useEffect } from "react"
import {
  RouteStateShell,
  type SecondaryLink,
} from "@/components/route-state-shell"

export function RouteErrorView({
  error,
  reset,
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryLinks = [],
}: {
  error: Error & { digest?: string }
  reset: () => void
  eyebrow: string
  title: string
  description: string
  primaryHref: string
  primaryLabel: string
  secondaryLinks?: SecondaryLink[]
}) {
  useEffect(() => {
    console.error("Route error boundary caught an error", error)
  }, [error])

  const isDev = process.env.NODE_ENV === "development"
  const safeMessage = isDev
    ? error.message || "Unknown error"
    : "An unexpected error occurred."

  return (
    <RouteStateShell
      eyebrow={eyebrow}
      title={title}
      description={description}
      primaryHref={primaryHref}
      primaryLabel={primaryLabel}
      secondaryLinks={secondaryLinks}
      backgroundClassName="bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_35%),linear-gradient(180deg,_#05070a_0%,_#090d12_100%)]"
      eyebrowClassName="text-xs uppercase tracking-[0.35em] text-cyan-400"
      primaryActionClassName="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
      secondaryActionClassName="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
      actionsClassName="mt-8 flex flex-wrap gap-3"
      leadingAction={
        <button
          onClick={() => reset()}
          className="cursor-pointer rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
        >
          Try Again
        </button>
      }
    >
        <p className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-xs text-zinc-500">
          {safeMessage}
        </p>
    </RouteStateShell>
  )
}
