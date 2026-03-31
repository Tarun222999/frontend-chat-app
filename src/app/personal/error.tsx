"use client"

import { RouteErrorView } from "@/components/route-error-view"

export default function PersonalError({
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
      eyebrow="Personal Chat"
      title="Personal chat hit an unexpected error."
      description="Retry the page or head back to the personal chat scaffold."
      primaryHref="/personal"
      primaryLabel="Back to Personal Chat"
    />
  )
}
