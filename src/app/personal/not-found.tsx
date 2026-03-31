import { NotFoundView } from "@/components/not-found-view"

export default function PersonalNotFound() {
  return (
    <NotFoundView
      eyebrow="Personal Chat"
      title="That personal chat page was not found."
      description="The personal messaging route you opened does not exist in this scaffold."
      primaryHref="/personal"
      primaryLabel="Back to Personal Chat"
      secondaryLinks={[{ href: "/", label: "Chooser" }]}
    />
  )
}
