import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PersonalShellNav } from "./personal-shell-nav"

const { mockReplace, mockLogout, mockLogoutMutationState } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockLogout: vi.fn(),
  mockLogoutMutationState: {
    isPending: false,
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}))

vi.mock("./hooks", () => ({
  usePersonalLogoutMutation: () => ({
    mutateAsync: mockLogout,
    isPending: mockLogoutMutationState.isPending,
  }),
}))

describe("PersonalShellNav", () => {
  beforeEach(() => {
    mockReplace.mockReset()
    mockLogout.mockReset()
    mockLogoutMutationState.isPending = false
  })

  it("shows the profile menu and logs out authenticated users", async () => {
    mockLogout.mockResolvedValueOnce(undefined)

    render(
      <PersonalShellNav
        session={{
          isAuthenticated: true,
          user: {
            id: "user-1",
            handle: "echo",
            displayName: "Echo Vale",
            avatarUrl: null,
          },
        }}
      />,
    )

    expect(screen.getByRole("link", { name: "Chooser" })).toHaveAttribute(
      "href",
      "/",
    )

    fireEvent.click(screen.getByRole("button", { name: "Open profile menu" }))
    fireEvent.click(screen.getByRole("button", { name: "Logout" }))

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith("/personal/login")
    })
  })
})
