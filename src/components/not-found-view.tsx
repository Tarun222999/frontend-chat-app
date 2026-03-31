import {
  RouteStateShell,
  type SecondaryLink,
} from "@/components/route-state-shell"

export function NotFoundView({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryLinks = [],
}: {
  eyebrow: string
  title: string
  description: string
  primaryHref: string
  primaryLabel: string
  secondaryLinks?: SecondaryLink[]
}) {
  return (
    <RouteStateShell
      eyebrow={eyebrow}
      title={title}
      description={description}
      primaryHref={primaryHref}
      primaryLabel={primaryLabel}
      secondaryLinks={secondaryLinks}
      contentClassName="text-center"
      actionsClassName="mt-8 flex flex-wrap items-center justify-center gap-3"
    />
  )
}
