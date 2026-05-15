"use client"

export function AiInboxPlaceholder() {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-[1.75rem] border border-zinc-800/75 bg-zinc-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="border-b border-zinc-800/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
            AI Chat
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            Conversations
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Saved AI threads will appear here.
          </p>
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-20 rounded-2xl border border-zinc-800/70 bg-black/20"
            />
          ))}
        </div>
      </div>

      <div className="flex min-h-[34rem] items-center justify-center overflow-hidden rounded-[1.75rem] border border-orange-500/20 bg-black/30 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
        <div className="max-w-md text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
            Ready
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
            AI Chat shell is ready.
          </h2>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            The next step will replace this placeholder with the inbox list,
            starter prompts, and new chat actions.
          </p>
        </div>
      </div>
    </section>
  )
}
