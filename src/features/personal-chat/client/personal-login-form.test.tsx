import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PersonalChatApiError } from "./personal-chat-api"
import { PersonalLoginForm } from "./personal-login-form"

const { mockReplace, mockMutateAsync, mockMutationState } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockMutationState: {
    isPending: false,
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}))

vi.mock("./hooks", () => ({
  usePersonalLoginMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockMutationState.isPending,
  }),
}))

describe("PersonalLoginForm", () => {
  beforeEach(() => {
    mockMutationState.isPending = false
    mockReplace.mockReset()
    mockMutateAsync.mockReset()
  })

  it("submits credentials and redirects to the provided target", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      isAuthenticated: true,
      user: {
        id: "user-1",
        handle: "echo",
        displayName: "Echo",
        avatarUrl: null,
      },
    })

    render(<PersonalLoginForm redirectTo="/personal/chat/demo-thread" />)

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "echo@stitch.local" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123!" },
    })
    fireEvent.submit(screen.getByRole("button", { name: "Sign In" }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: "echo@stitch.local",
        password: "Password123!",
      })
      expect(mockReplace).toHaveBeenCalledWith("/personal/chat/demo-thread")
    })
  })

  it("shows an inline auth error when the login fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new PersonalChatApiError("Invalid email or password", 401, {
        error: "Invalid email or password",
      }),
    )

    render(<PersonalLoginForm />)

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "wrong@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrongpass" },
    })
    fireEvent.submit(screen.getByRole("button", { name: "Sign In" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password. Please try again.",
    )
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("fills the mock credentials when requested", () => {
    render(<PersonalLoginForm showMockCredentials />)

    fireEvent.click(screen.getByRole("button", { name: "Use Mock Login" }))

    expect(screen.getByLabelText("Email")).toHaveValue("echo@stitch.local")
    expect(screen.getByLabelText("Password")).toHaveValue("Password123!")
  })
})
