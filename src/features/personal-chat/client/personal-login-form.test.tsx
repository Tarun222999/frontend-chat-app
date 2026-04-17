import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PersonalChatApiError } from "./personal-chat-api"
import { PersonalLoginForm } from "./personal-login-form"

const {
  mockReplace,
  mockLoginMutateAsync,
  mockRegisterMutateAsync,
  mockLoginMutationState,
  mockRegisterMutationState,
} = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockLoginMutateAsync: vi.fn(),
  mockRegisterMutateAsync: vi.fn(),
  mockLoginMutationState: {
    isPending: false,
  },
  mockRegisterMutationState: {
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
    mutateAsync: mockLoginMutateAsync,
    isPending: mockLoginMutationState.isPending,
  }),
  usePersonalRegisterMutation: () => ({
    mutateAsync: mockRegisterMutateAsync,
    isPending: mockRegisterMutationState.isPending,
  }),
}))

describe("PersonalLoginForm", () => {
  beforeEach(() => {
    mockLoginMutationState.isPending = false
    mockRegisterMutationState.isPending = false
    mockReplace.mockReset()
    mockLoginMutateAsync.mockReset()
    mockRegisterMutateAsync.mockReset()
  })

  it("submits credentials and redirects to the provided target", async () => {
    mockLoginMutateAsync.mockResolvedValueOnce({
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
    fireEvent.click(screen.getAllByRole("button", { name: "Sign In" }).at(-1)!)

    await waitFor(() => {
      expect(mockLoginMutateAsync).toHaveBeenCalledWith({
        email: "echo@stitch.local",
        password: "Password123!",
      })
      expect(mockReplace).toHaveBeenCalledWith("/personal/chat/demo-thread")
    })
  })

  it("shows an inline auth error when the login fails", async () => {
    mockLoginMutateAsync.mockRejectedValueOnce(
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
    fireEvent.click(screen.getAllByRole("button", { name: "Sign In" }).at(-1)!)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password. Please try again.",
    )
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("submits registration details and redirects after account creation", async () => {
    mockRegisterMutateAsync.mockResolvedValueOnce({
      isAuthenticated: true,
      user: {
        id: "user-2",
        handle: "mira",
        displayName: "Mira Hart",
        avatarUrl: null,
      },
    })

    render(<PersonalLoginForm redirectTo="/personal" />)

    fireEvent.click(screen.getAllByRole("button", { name: "Create Account" })[0]!)
    fireEvent.change(screen.getByLabelText("Display Name"), {
      target: { value: "Mira Hart" },
    })
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "mira@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123!" },
    })
    fireEvent.click(screen.getAllByRole("button", { name: "Create Account" }).at(-1)!)

    await waitFor(() => {
      expect(mockRegisterMutateAsync).toHaveBeenCalledWith({
        displayName: "Mira Hart",
        email: "mira@example.com",
        password: "Password123!",
      })
      expect(mockReplace).toHaveBeenCalledWith("/personal")
    })
  })

  it("shows a clear duplicate-email error during registration", async () => {
    mockRegisterMutateAsync.mockRejectedValueOnce(
      new PersonalChatApiError("User with this email already exists", 409, {
        error: "User with this email already exists",
      }),
    )

    render(<PersonalLoginForm />)

    fireEvent.click(screen.getAllByRole("button", { name: "Create Account" })[0]!)
    fireEvent.change(screen.getByLabelText("Display Name"), {
      target: { value: "Mira Hart" },
    })
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "mira@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123!" },
    })
    fireEvent.click(screen.getAllByRole("button", { name: "Create Account" }).at(-1)!)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account with this email already exists. Sign in instead.",
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
