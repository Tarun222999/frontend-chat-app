"use client"

export function AiConversationPlaceholder({
  conversationId,
}: {
  conversationId: string
}) {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border border-zinc-800 bg-zinc-950/70 sm:rounded-3xl">
      <header className="shrink-0 border-b border-orange-500/10 bg-black/35 px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-orange-300">
          AI Conversation
        </p>
        <h1 className="mt-2 truncate text-lg font-semibold text-white">
          {conversationId}
        </h1>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(circle_at_50%_0%,rgba(251,146,60,0.08),transparent_34%),linear-gradient(180deg,rgba(251,146,60,0.035),transparent_44%)] px-4 py-5">
        <div className="max-w-md border border-dashed border-orange-500/25 bg-black/25 px-5 py-8 text-center">
          <p className="text-sm font-medium text-white">
            Conversation view placeholder
          </p>
          <p className="mt-2 text-sm leading-7 text-zinc-400">
            The next UI steps will load messages, add the composer, and stream
            assistant replies here.
          </p>
        </div>
      </div>
    </section>
  )
}
