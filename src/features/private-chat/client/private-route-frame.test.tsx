import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PrivateRouteFrame } from "./private-route-frame"

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}))

vi.mock("./private-shell-nav", () => ({
  PrivateShellNav: () => <div>Privacy nav</div>,
}))

describe("PrivateRouteFrame", () => {
  beforeEach(() => {
    mockUsePathname.mockReset()
  })

  it("shows the privacy chat header on the lobby route", () => {
    mockUsePathname.mockReturnValue("/private")

    render(
      <PrivateRouteFrame>
        <div>Private lobby</div>
      </PrivateRouteFrame>,
    )

    expect(screen.getByRole("link", { name: "Privacy chat" })).toBeInTheDocument()
    expect(screen.getByText("Secure rooms")).toBeInTheDocument()
    expect(screen.getByText("Privacy nav")).toBeInTheDocument()
    expect(screen.getByText("Private lobby")).toBeInTheDocument()
  })

  it("hides the shell header on secure room routes", () => {
    mockUsePathname.mockReturnValue("/private/room/room-123")

    render(
      <PrivateRouteFrame>
        <div>Private room</div>
      </PrivateRouteFrame>,
    )

    expect(
      screen.queryByRole("link", { name: "Privacy chat" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Privacy nav")).not.toBeInTheDocument()
    expect(screen.getByText("Private room")).toBeInTheDocument()
  })
})
