import Link from "next/link"
import {
  PersonalLoginForm,
} from "@/features/personal-chat/client"
import {
  resolvePersonalLoginSuccessPath,
} from "@/features/personal-chat/route-guard-paths"
import {
  personalChatServerConfig,
  redirectAuthenticatedPersonalRoute,
} from "@/features/personal-chat/server"

export default async function PersonalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const { next } = await searchParams
  const redirectTo = resolvePersonalLoginSuccessPath(
    Array.isArray(next) ? next[0] : next,
  )
  const showMockCredentials = personalChatServerConfig.serviceMode === "mock"

  await redirectAuthenticatedPersonalRoute()

  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950/70 p-8">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Login</p>
      <h2 className="mt-3 text-3xl font-semibold text-white">
        Sign in to personal chat
      </h2>
      <p className="mt-4 text-sm leading-7 text-zinc-400">
        Your session stays inside the BFF cookie layer. After a successful
        sign-in, we&apos;ll send you back to the personal route you were trying
        to open.
      </p>

      <PersonalLoginForm
        redirectTo={redirectTo}
        showMockCredentials={showMockCredentials}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          prefetch={false}
          className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
        >
          Back to Chooser
        </Link>
      </div>
    </section>
  )
}
