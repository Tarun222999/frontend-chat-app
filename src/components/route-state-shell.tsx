import Link from "next/link"
import type { ReactNode } from "react"

export type SecondaryLink = {
  href: string
  label: string
}

type RouteStateShellProps = {
  eyebrow: string
  title: string
  description: string
  primaryHref: string
  primaryLabel: string
  secondaryLinks?: SecondaryLink[]
  children?: ReactNode
  leadingAction?: ReactNode
  backgroundClassName?: string
  panelClassName?: string
  eyebrowClassName?: string
  primaryActionClassName?: string
  secondaryActionClassName?: string
  contentClassName?: string
  actionsClassName?: string
  viewportClassName?: string
}

export function RouteStateShell({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryLinks = [],
  children,
  leadingAction,
  backgroundClassName = "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_35%),linear-gradient(180deg,_#05070a_0%,_#090d12_100%)]",
  panelClassName = "w-full max-w-xl rounded-3xl border border-zinc-800 bg-black/40 p-8 shadow-2xl shadow-black/30",
  eyebrowClassName = "text-xs uppercase tracking-[0.35em] text-green-500",
  primaryActionClassName = "rounded-full bg-green-500 px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90",
  secondaryActionClassName = "rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-green-500 hover:text-white",
  contentClassName,
  actionsClassName = "mt-8 flex flex-wrap gap-3",
  viewportClassName = "min-h-screen",
}: RouteStateShellProps) {
  return (
    <main
      className={`flex items-center justify-center px-4 py-10 text-zinc-100 ${viewportClassName} ${backgroundClassName}`}
    >
      <div className={panelClassName}>
        <div className={contentClassName}>
          <p className={eyebrowClassName}>{eyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">{title}</h1>
          <p className="mt-4 text-sm leading-7 text-zinc-400">{description}</p>
          {children}
        </div>

        <div className={actionsClassName}>
          {leadingAction}
          <Link href={primaryHref} className={primaryActionClassName}>
            {primaryLabel}
          </Link>
          {secondaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={secondaryActionClassName}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
