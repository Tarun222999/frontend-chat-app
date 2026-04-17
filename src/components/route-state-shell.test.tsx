import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RouteStateShell } from "@/components/route-state-shell"

describe("RouteStateShell", () => {
  it("renders the main route copy and actions", () => {
    render(
      <RouteStateShell
        eyebrow="Status"
        title="Route missing"
        description="Choose another path to continue."
        primaryHref="/private"
        primaryLabel="Open Private Chat"
        secondaryLinks={[{ href: "/", label: "Back Home" }]}
      >
        <p>Extra supporting copy</p>
      </RouteStateShell>,
    )

    expect(
      screen.getByRole("heading", { name: "Route missing" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Choose another path to continue."),
    ).toBeInTheDocument()
    expect(screen.getByText("Extra supporting copy")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Open Private Chat" }),
    ).toHaveAttribute("href", "/private")
    expect(screen.getByRole("link", { name: "Back Home" })).toHaveAttribute(
      "href",
      "/",
    )
  })
})
