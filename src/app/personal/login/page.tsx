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
    <section className="grid w-full items-center gap-10 py-4 lg:min-h-[calc(100vh-11rem)] lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] lg:gap-14">
      <div className="max-w-2xl space-y-8 lg:pb-10">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-sky-300">
            PERSONAL CHAT
          </p>
          <h1 className="max-w-lg text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Your secure home for direct conversations.
          </h1>
          <p className="max-w-lg text-sm leading-7 text-zinc-400 sm:text-base">
            Persistent conversations. Direct messaging. Your private inbox.
          </p>
        </div>

        <div className="border-l-2 border-sky-400/70 pl-4 text-xs font-semibold uppercase tracking-[0.28em] text-sky-200">
          PERSONAL &bull; PRIVATE &bull; AI
        </div>
      </div>

      <div className="border border-zinc-800/80 bg-zinc-950/55 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-md sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
          Personal Space
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Enter Personal Space
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Continue into your personal inbox.
        </p>

        <PersonalLoginForm
          redirectTo={redirectTo}
          showMockCredentials={showMockCredentials}
        />
      </div>
    </section>
  )
}
