import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PrivateShellNav } from "./private-shell-nav"

describe("PrivateShellNav", () => {
  it("links to personal chat without querying the personal session", () => {
    render(<PrivateShellNav />)

    expect(screen.getByRole("link", { name: "Choose Space" })).toHaveAttribute(
      "href",
      "/",
    )
    expect(screen.getByRole("link", { name: "Personal Chat" })).toHaveAttribute(
      "href",
      "/personal",
    )
  })

  it("opens the mobile navigation drawer", () => {
    render(<PrivateShellNav />)

    const menuButton = screen.getByRole("button", {
      name: "Open navigation menu",
    })

    expect(menuButton).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(menuButton)

    expect(menuButton).toHaveAttribute("aria-expanded", "true")
    expect(screen.getAllByRole("link", { name: "Choose Space" })).toHaveLength(
      2,
    )
    expect(
      screen.getAllByRole("link", { name: "Personal Chat" }).at(-1),
    ).toHaveAttribute("href", "/personal")
  })
})
