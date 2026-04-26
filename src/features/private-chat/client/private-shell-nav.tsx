import Link from "next/link"

const navLinkClassName =
  "rounded-full border border-zinc-800 bg-black/20 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-green-400 hover:text-white"

export function PrivateShellNav() {
  return (
    <nav aria-label="Privacy chat" className="flex flex-wrap items-center gap-3">
      <Link
        href="/"
        prefetch={false}
        className={navLinkClassName}
      >
        Chooser
      </Link>

      <Link
        href="/personal"
        prefetch={false}
        className={navLinkClassName}
      >
        Personal inbox
      </Link>
    </nav>
  )
}
