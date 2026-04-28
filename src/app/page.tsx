import Link from "next/link"

export const dynamic = "force-static"

const productOptions = [
  {
    href: "/personal",
    eyebrow: "Personal",
    title: "Personal Chat",
    description: "Your secure space for everyday conversations.",
    cta: "Enter Personal",
  },
  {
    href: "/private",
    eyebrow: "Private",
    title: "Private Chat",
    description: "Encrypted rooms that disappear in ",
    highlight: "10 MIN",
    descriptionSuffix: ".",
    cta: "Enter Private",
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_35%),linear-gradient(180deg,_#05070a_0%,_#090d12_100%)] px-4 py-10 text-zinc-100">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-center gap-10">
        <section className="max-w-3xl space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.42em] text-green-400 sm:text-base">
              PULSE
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-zinc-500">
              Personal &bull; Private &bull; AI
            </p>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Every conversation deserves the right space.
          </h1>
          <p className="text-base leading-7 text-zinc-400 sm:text-lg">
            One platform for personal, private, and AI conversations.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-l-2 border-green-400/70 pl-4 pt-1 text-sm font-semibold tracking-wide text-zinc-200">
            <span>Message daily.</span>
            <span className="text-green-300">Go private when it matters.</span>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {productOptions.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className="group rounded-3xl border border-zinc-700/80 bg-zinc-950/85 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)] transition-colors hover:border-green-500/70 hover:bg-zinc-950"
            >
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 transition-colors group-hover:text-green-500">
                  {option.eyebrow}
                </p>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold text-white">
                    {option.title}
                  </h2>
                  <p className="text-[0.95rem] leading-7 text-zinc-300">
                    {option.description}
                    {"highlight" in option ? (
                      <span className="mx-0.5 inline-flex translate-y-[-0.05em] items-center rounded-full bg-green-500/10 px-2.5 py-px font-semibold leading-5 text-green-300 ring-1 ring-green-500/30">
                        {option.highlight}
                      </span>
                    ) : null}
                    {"descriptionSuffix" in option
                      ? option.descriptionSuffix
                      : null}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 pt-1 text-base font-semibold text-green-400">
                  <span>{option.cta}</span>
                  <span
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    &rarr;
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
