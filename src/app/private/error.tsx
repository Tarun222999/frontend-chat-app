"use client"

import { RouteErrorView } from "@/components/route-error-view"

export default function PrivateError({
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
      eyebrow="Private Chat"
      title="Private chat hit an unexpected error."
      description="Retry the view or head back to the private chat landing page."
      primaryHref="/private"
      primaryLabel="Back to Private Chat"
      viewportClassName="min-h-full"
    />
  )
}
