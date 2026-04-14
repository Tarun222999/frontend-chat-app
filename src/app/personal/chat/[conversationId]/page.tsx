import { PersonalProtectedRouteGuard } from "@/features/personal-chat/client"
import { requirePersonalRouteSession } from "@/features/personal-chat/server"

export default async function PersonalChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const conversationPath = `/personal/chat/${conversationId}`

  await requirePersonalRouteSession(conversationPath)

  return (
    <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
      <PersonalProtectedRouteGuard />
      <aside className="rounded-3xl border border-zinc-800 bg-black/30 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Conversation
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          {conversationId}
        </h2>
        <p className="mt-4 text-sm leading-7 text-zinc-400">
          This is the future DM detail route. In the next steps it will fetch
          conversation history, join realtime updates, and host the personal
          composer.
        </p>
      </aside>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
          Chat view scaffold
        </p>
        <div className="mt-6 space-y-4 text-sm text-zinc-400">
          <p>Message history will render here once the personal adapter lands.</p>
          <p>Realtime presence and optimistic sends are deferred to later steps.</p>
        </div>
      </div>
    </section>
  )
}
