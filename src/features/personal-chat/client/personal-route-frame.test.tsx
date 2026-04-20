import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PersonalRouteFrame } from "./personal-route-frame"

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}))

vi.mock("./personal-shell-nav", () => ({
  PersonalShellNav: () => <div>Shell nav</div>,
}))

describe("PersonalRouteFrame", () => {
  beforeEach(() => {
    mockUsePathname.mockReset()
  })

  it("shows the personal shell header outside conversation routes", () => {
    mockUsePathname.mockReturnValue("/personal")

    render(
      <PersonalRouteFrame
        session={{
          isAuthenticated: true,
          user: {
            id: "user-1",
            handle: "echo",
            displayName: "Echo Vale",
            avatarUrl: null,
          },
        }}
      >
        <div>Inbox content</div>
      </PersonalRouteFrame>,
    )

    expect(screen.getByRole("link", { name: "Personal inbox" })).toBeInTheDocument()
    expect(screen.getByText("Direct messages")).toBeInTheDocument()
    expect(screen.getByText("Shell nav")).toBeInTheDocument()
    expect(screen.getByText("Inbox content")).toBeInTheDocument()
  })

  it("hides the personal shell header on conversation routes", () => {
    mockUsePathname.mockReturnValue("/personal/chat/conversation-1")

    render(
      <PersonalRouteFrame
        session={{
          isAuthenticated: true,
          user: {
            id: "user-1",
            handle: "echo",
            displayName: "Echo Vale",
            avatarUrl: null,
          },
        }}
      >
        <div>Conversation content</div>
      </PersonalRouteFrame>,
    )

    expect(
      screen.queryByRole("link", { name: "Personal inbox" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Shell nav")).not.toBeInTheDocument()
    expect(screen.getByText("Conversation content")).toBeInTheDocument()
  })
})
