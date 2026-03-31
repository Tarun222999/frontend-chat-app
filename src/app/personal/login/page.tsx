import Link from "next/link"

export default function PersonalLoginPage() {
  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950/70 p-8">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Login</p>
      <h2 className="mt-3 text-3xl font-semibold text-white">
        Personal auth placeholder
      </h2>
      <p className="mt-4 text-sm leading-7 text-zinc-400">
        This page is reserved for the personal-chat sign-in flow. Cookie-backed
        session checks and redirect logic will be added when the BFF auth slice
        is implemented.
      </p>

      <div className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-black/20 p-5 text-sm text-zinc-400">
        Form fields are intentionally deferred in this step so the route
        structure can settle before auth wiring lands.
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/personal"
          className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
        >
          Go to Inbox Scaffold
        </Link>
        <Link
          href="/"
          className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white"
        >
          Back to Chooser
        </Link>
      </div>
    </section>
  )
}
