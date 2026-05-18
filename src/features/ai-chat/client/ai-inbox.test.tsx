import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AiInbox } from "./ai-inbox"

const {
  mockCreateConversation,
  mockDeleteConversation,
  mockPush,
  mockConversationSummariesQuery,
} = vi.hoisted(() => ({
  mockCreateConversation: vi.fn(),
  mockDeleteConversation: vi.fn(),
  mockPush: vi.fn(),
  mockConversationSummariesQuery: {
    data: [
      {
        id: "conversation-1",
        title: "Architecture Review",
        model: {
          profile: "free",
          provider: "google",
          modelId: "gemini-2.5-flash-lite",
        },
        lastMessagePreview: null,
        lastMessageAt: "2026-05-17T12:15:00.000Z",
        createdAt: "2026-05-17T12:00:00.000Z",
        updatedAt: "2026-05-17T12:15:00.000Z",
      },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock("./hooks", () => ({
  useAiConversationSummariesQuery: () => mockConversationSummariesQuery,
  useCreateAiConversationMutation: () => ({
    mutateAsync: mockCreateConversation,
    isPending: false,
  }),
  useDeleteAiConversationMutation: () => ({
    mutateAsync: mockDeleteConversation,
  }),
}))

describe("AiInbox", () => {
  beforeEach(() => {
    mockCreateConversation.mockReset()
    mockDeleteConversation.mockReset()
    mockPush.mockReset()
  })

  it("uses an in-app delete dialog before deleting a conversation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm")
    mockDeleteConversation.mockResolvedValueOnce(undefined)

    render(<AiInbox />)

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Architecture Review" }),
    )

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog", { name: "Delete AI chat?" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(mockDeleteConversation).toHaveBeenCalledWith("conversation-1")
    })

    confirmSpy.mockRestore()
  })

  it("uses starter card titles when creating prompted conversations", async () => {
    mockCreateConversation.mockResolvedValueOnce({
      id: "conversation-2",
    })

    render(<AiInbox />)

    fireEvent.click(
      screen.getByRole("button", { name: /Review this UI decision/i }),
    )

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Review this UI decision",
          initialMessage: expect.stringContaining("product designer"),
        }),
      )
    })
  })
})
