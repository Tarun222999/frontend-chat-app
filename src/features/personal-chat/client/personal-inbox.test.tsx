import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PersonalInbox } from "./personal-inbox"

const {
  mockPush,
  mockReplace,
  mockOpenDirectConversation,
  mockLogout,
  mockSessionQuery,
  mockDmCandidatesQuery,
  mockConversationSummariesQuery,
  mockOpenMutationState,
  mockLogoutMutationState,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockOpenDirectConversation: vi.fn(),
  mockLogout: vi.fn(),
  mockSessionQuery: {
    data: {
      isAuthenticated: true,
      user: {
        id: "user-1",
        handle: "echo",
        displayName: "Echo Vale",
        avatarUrl: null,
      },
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  mockDmCandidatesQuery: {
    data: [
      {
        id: "user-2",
        handle: "delta",
        displayName: "Delta Lane",
        avatarUrl: null,
        isAvailable: true,
      },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  mockConversationSummariesQuery: {
    data: [
      {
        id: "conversation-1",
        participant: {
          id: "user-3",
          handle: "stitch",
          displayName: "Stitch Harper",
          avatarUrl: null,
        },
        lastMessagePreview: "See you in the secure room.",
        lastMessageAt: "2026-04-15T12:00:00.000Z",
        unreadCount: 2,
      },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  mockOpenMutationState: {
    isPending: false,
  },
  mockLogoutMutationState: {
    isPending: false,
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}))

vi.mock("./hooks", () => ({
  usePersonalSessionQuery: () => mockSessionQuery,
  useDmCandidatesQuery: () => mockDmCandidatesQuery,
  useConversationSummariesQuery: () => mockConversationSummariesQuery,
  useOpenDirectConversationMutation: () => ({
    mutateAsync: mockOpenDirectConversation,
    isPending: mockOpenMutationState.isPending,
  }),
  usePersonalLogoutMutation: () => ({
    mutateAsync: mockLogout,
    isPending: mockLogoutMutationState.isPending,
  }),
}))

describe("PersonalInbox", () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockReplace.mockReset()
    mockOpenDirectConversation.mockReset()
    mockLogout.mockReset()
    mockOpenMutationState.isPending = false
    mockLogoutMutationState.isPending = false
  })

  it("renders personal inbox data and opens a DM from a candidate", async () => {
    mockOpenDirectConversation.mockResolvedValueOnce({
      id: "conversation-2",
      participant: {
        id: "user-2",
        handle: "delta",
        displayName: "Delta Lane",
        avatarUrl: null,
      },
      lastMessagePreview: null,
      lastMessageAt: null,
      unreadCount: 0,
    })

    render(<PersonalInbox />)

    expect(screen.getByText("Echo Vale")).toBeInTheDocument()
    expect(screen.getByText("Delta Lane")).toBeInTheDocument()
    expect(screen.getByText("Stitch Harper")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /open direct message/i }))

    await waitFor(() => {
      expect(mockOpenDirectConversation).toHaveBeenCalledWith({
        participantId: "user-2",
      })
      expect(mockPush).toHaveBeenCalledWith("/personal/chat/conversation-2")
    })
  })

  it("signs out and routes back to the personal login page", async () => {
    mockLogout.mockResolvedValueOnce(undefined)

    render(<PersonalInbox />)

    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }))

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith("/personal/login")
    })
  })
})
