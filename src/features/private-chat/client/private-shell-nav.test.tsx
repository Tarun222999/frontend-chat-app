import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PersonalSession } from "@/features/personal-chat/domain"
import { PrivateShellNav } from "./private-shell-nav"

const { mockSessionQuery } = vi.hoisted(() => ({
  mockSessionQuery: {
    data: undefined as PersonalSession | undefined,
  },
}))

vi.mock("@/features/personal-chat/client/hooks", () => ({
  usePersonalSessionQuery: () => mockSessionQuery,
}))

describe("PrivateShellNav", () => {
  beforeEach(() => {
    mockSessionQuery.data = {
      isAuthenticated: false,
      user: null,
    }
  })

  it("links to personal login when the personal session is logged out", () => {
    render(<PrivateShellNav />)

    expect(screen.getByRole("link", { name: "Choose Space" })).toHaveAttribute(
      "href",
      "/",
    )
    expect(screen.getByRole("link", { name: "Personal Login" })).toHaveAttribute(
      "href",
      "/personal/login",
    )
  })

  it("links to personal chat when the personal session is logged in", () => {
    mockSessionQuery.data = {
      isAuthenticated: true,
      user: {
        id: "user-1",
        handle: "echo",
        displayName: "Echo Vale",
        avatarUrl: null,
      },
    }

    render(<PrivateShellNav />)

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
      screen.getAllByRole("link", { name: "Personal Login" }).at(-1),
    ).toHaveAttribute("href", "/personal/login")
  })
})
