"use client"

import Link from "next/link"

type SecondaryLink = {
  href: string
  label: string
}

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
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_35%),linear-gradient(180deg,_#05070a_0%,_#090d12_100%)] px-4 py-10 text-zinc-100">
      <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-black/40 p-8 shadow-2xl shadow-black/30">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">{description}</p>
        <p className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-xs text-zinc-500">
          {error.message || "Unknown error"}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={() => reset()}
            className="cursor-pointer rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
          >
            Try Again
          </button>
          <Link
            href={primaryHref}
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
          >
            {primaryLabel}
          </Link>
          {secondaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
