import Link from "next/link"

type SecondaryLink = {
  href: string
  label: string
}

export function NotFoundView({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryLinks = [],
}: {
  eyebrow: string
  title: string
  description: string
  primaryHref: string
  primaryLabel: string
  secondaryLinks?: SecondaryLink[]
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_35%),linear-gradient(180deg,_#05070a_0%,_#090d12_100%)] px-4 py-10 text-zinc-100">
      <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-black/40 p-8 text-center shadow-2xl shadow-black/30">
        <p className="text-xs uppercase tracking-[0.35em] text-green-500">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">{description}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={primaryHref}
            className="rounded-full bg-green-500 px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            {primaryLabel}
          </Link>
          {secondaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-green-500 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
