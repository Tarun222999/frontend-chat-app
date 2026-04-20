import Link from "next/link"
import { PersonalShellNav } from "@/features/personal-chat/client"
import { getPersonalRouteSession } from "@/features/personal-chat/server"

export default async function PersonalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getPersonalRouteSession()

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#071018_0%,_#0a0d11_100%)] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-[#091118]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <Link
              href={session.isAuthenticated ? "/personal" : "/personal/login"}
              prefetch={false}
              className="text-lg font-semibold text-white transition-colors hover:text-cyan-200"
            >
              Personal inbox
            </Link>
            <p className="mt-1 text-xs uppercase tracking-[0.28em] text-cyan-400">
              Direct messages
            </p>
          </div>

          <PersonalShellNav session={session} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}
