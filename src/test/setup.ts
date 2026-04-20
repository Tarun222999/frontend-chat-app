import React from "react"
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => {
  cleanup()
})

if (
  typeof HTMLElement !== "undefined" &&
  !HTMLElement.prototype.scrollIntoView
) {
  HTMLElement.prototype.scrollIntoView = () => {}
}

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...props
  }: {
    href: string | { pathname?: string }
    children: React.ReactNode
    prefetch?: boolean
  }) => {
    void _prefetch

    const resolvedHref =
      typeof href === "string"
        ? href
        : typeof href === "object" && href !== null
          ? href.pathname ?? ""
          : ""

    return React.createElement("a", { href: resolvedHref, ...props }, children)
  },
}))
