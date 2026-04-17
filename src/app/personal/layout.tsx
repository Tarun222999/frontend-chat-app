import Link from "next/link"
import { getPersonalRouteSession } from "@/features/personal-chat/server"

export default async function PersonalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getPersonalRouteSession()

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#071018_0%,_#0a0d11_100%)] text-zinc-100">
      <header className="border-b border-zinc-800 bg-black/30 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">
              Personal Chat
            </p>
            <h1 className="text-lg font-semibold text-white">
              Personal messaging scaffold
            </h1>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/"
              prefetch={false}
              className="rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-cyan-400 hover:text-white"
            >
              Chooser
            </Link>
            {session.isAuthenticated ? (
              <Link
                href="/personal"
                prefetch={false}
                className="rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-cyan-400 hover:text-white"
              >
                Inbox
              </Link>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>
    </div>
  )
}
