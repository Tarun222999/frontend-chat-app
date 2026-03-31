import { NotFoundView } from "@/components/not-found-view"

export default function GlobalNotFound() {
  return (
    <NotFoundView
      eyebrow="404"
      title="We could not find that page."
      description="The route you asked for does not exist in this app."
      primaryHref="/"
      primaryLabel="Back to Chooser"
      secondaryLinks={[
        { href: "/private", label: "Private Chat" },
        { href: "/personal", label: "Personal Chat" },
      ]}
    />
  )
}
