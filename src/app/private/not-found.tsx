import { NotFoundView } from "@/components/not-found-view"

export default function PrivateNotFound() {
  return (
    <NotFoundView
      eyebrow="Private Chat"
      title="That private chat route does not exist."
      description="The secure room or private-chat page you asked for is not available at this path."
      primaryHref="/private"
      primaryLabel="Back to Private Chat"
      secondaryLinks={[{ href: "/", label: "Chooser" }]}
      viewportClassName="min-h-full"
    />
  )
}
