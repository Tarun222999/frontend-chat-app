import Link from "next/link"

const productOptions = [
  {
    href: "/personal",
    eyebrow: "Inbox First",
    title: "Personal Inbox",
    description:
      "Start with people, profiles, and direct messages in a personal inbox built around your everyday conversations.",
    cta: "Open Personal Inbox",
  },
  {
    href: "/private",
    eyebrow: "Secure Room",
    title: "Private Chat",
    description:
      "Create a short-lived encrypted room when a conversation needs a separate two-person space with self-destructing history.",
    cta: "Open Private Chat",
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_35%),linear-gradient(180deg,_#05070a_0%,_#090d12_100%)] px-4 py-10 text-zinc-100">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-center gap-10">
        <section className="max-w-2xl space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-green-500">
            Stitch Chat
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Start with people, then open the right chat space.
          </h1>
          <p className="text-base leading-7 text-zinc-400 sm:text-lg">
            Stitch Chat now gives personal messaging its own inbox-first home,
            while secure rooms stay available as a separate path for short-lived
            private conversations.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {productOptions.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className="group rounded-3xl border border-zinc-800 bg-zinc-950/70 p-7 transition-colors hover:border-green-500/60 hover:bg-zinc-950"
            >
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 transition-colors group-hover:text-green-500">
                  {option.eyebrow}
                </p>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-white">
                    {option.title}
                  </h2>
                  <p className="text-sm leading-6 text-zinc-400">
                    {option.description}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-green-400">
                  <span>{option.cta}</span>
                  <span
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    -&gt;
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
