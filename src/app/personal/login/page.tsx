import {
  PersonalLoginForm,
} from "@/features/personal-chat/client"
import { resolveAccountLoginSuccessPath } from "@/features/auth/route-guard-paths"
import { redirectAuthenticatedAccountRoute } from "@/features/auth/server"
import {
  personalChatServerConfig,
} from "@/features/personal-chat/server"

export default async function PersonalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const { next } = await searchParams
  const redirectTo = resolveAccountLoginSuccessPath(
    Array.isArray(next) ? next[0] : next,
  )
  const showMockCredentials = personalChatServerConfig.serviceMode === "mock"

  await redirectAuthenticatedAccountRoute(redirectTo)

  return (
    <section className="grid w-full min-w-0 items-center gap-10 overflow-x-hidden py-3 lg:min-h-[calc(100vh-10rem)] lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] lg:gap-14">
      <div className="relative isolate min-w-0 py-10 lg:pb-12">
        <div
          aria-hidden="true"
          className="absolute inset-x-[-22%] top-1/2 -z-10 h-[38rem] -translate-y-1/2 bg-[radial-gradient(circle_at_20%_22%,rgba(56,189,248,0.14),transparent_32%),radial-gradient(circle_at_72%_24%,rgba(34,197,94,0.1),transparent_31%),radial-gradient(circle_at_54%_78%,rgba(245,158,11,0.1),transparent_34%)] blur-3xl"
        />

        <div className="min-w-0 max-w-2xl space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-zinc-500">
              PULSE IDENTITY
            </p>
            <h1 className="max-w-[21rem] break-words text-2xl font-semibold leading-tight tracking-tight text-white sm:max-w-2xl sm:text-4xl lg:text-[2.85rem]">
              One identity across personal, private, and AI conversations.
            </h1>
            <p className="max-w-[21rem] text-sm leading-7 text-zinc-400 sm:max-w-xl sm:text-base">
              Move seamlessly between people, private rooms, and AI threads.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-300">
              <span className="text-sky-300">Personal</span>
              <span className="text-emerald-300">Private</span>
              <span className="text-amber-300">AI</span>
            </div>
            <p className="max-w-md text-xs leading-6 text-zinc-500">
              Access all conversation modes with one account.
            </p>
          </div>
        </div>
      </div>

      <div className="relative min-w-0 overflow-hidden border border-zinc-800/70 bg-zinc-950/50 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-md sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-sky-400/40 via-emerald-300/35 to-amber-300/35"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
          Pulse Account
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Continue with Pulse
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Sign in once to access your conversations and AI workspace.
        </p>

        <PersonalLoginForm
          redirectTo={redirectTo}
          showMockCredentials={showMockCredentials}
        />
      </div>
    </section>
  )
}
