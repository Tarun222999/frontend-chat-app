"use client"

import { RouteErrorView } from "@/components/route-error-view"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorView
      error={error}
      reset={reset}
      eyebrow="Application Error"
      title="The app ran into an unexpected error."
      description="Retry the current view or head back to the route chooser."
      primaryHref="/"
      primaryLabel="Back to Chooser"
      secondaryLinks={[
        { href: "/private", label: "Private Chat" },
        { href: "/personal", label: "Personal Chat" },
      ]}
    />
  )
}
