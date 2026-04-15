import Link from "next/link"
import { personalInboxPath } from "@/features/personal-chat/route-guard-paths"
import { requirePersonalRouteSession } from "@/features/personal-chat/server"

export default async function PersonalInboxPage() {
  await requirePersonalRouteSession(personalInboxPath)

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
          Inbox
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-white">
          Personal inbox scaffold
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
          This route is now reserved for the authenticated personal-chat
          experience. Session redirects, real conversations, and message state
          will be layered in during the next changes.
        </p>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-black/30 p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Next steps
        </p>
        <div className="mt-4 space-y-4 text-sm text-zinc-400">
          <p>Use the login scaffold to preview the future entrypoint.</p>
          <p>Conversation detail routes are already mounted for the DM view.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/personal/chat/demo-thread"
            prefetch={false}
            className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
          >
            Open Chat Scaffold
          </Link>
          <Link
            href="/"
            prefetch={false}
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
          >
            Back to Chooser
          </Link>
        </div>
      </div>
    </section>
  )
}
