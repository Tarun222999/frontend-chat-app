import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PersonalConversation } from "./personal-conversation"

const {
  mockReplace,
  mockLogout,
  mockSendMessage,
  mockCreatePrivacyLink,
  mockCreateRealtimeSession,
  mockSessionQuery,
  mockConversationDetailQuery,
  mockSendMutationState,
  mockPrivacyMutationState,
  mockLogoutMutationState,
} = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockLogout: vi.fn(),
  mockSendMessage: vi.fn(),
  mockCreatePrivacyLink: vi.fn(),
  mockCreateRealtimeSession: vi.fn(),
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
  },
  mockConversationDetailQuery: {
    data: {
      id: "conversation-1",
      participant: {
        id: "user-2",
        handle: "delta",
        displayName: "Delta Lane",
        avatarUrl: null,
      },
      messages: [
        {
          id: "message-1",
          kind: "text",
          conversationId: "conversation-1",
          senderId: "user-2",
          sentAt: "2026-04-15T08:30:00.000Z",
          deliveryStatus: "sent",
          text: "Meet me in the thread.",
        },
      ],
      hasMoreHistory: false,
    },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  },
  mockSendMutationState: {
    isPending: false,
  },
  mockPrivacyMutationState: {
    isPending: false,
  },
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
  usePersonalSessionQuery: () => mockSessionQuery,
  useConversationDetailQuery: () => mockConversationDetailQuery,
  useSendPersonalChatMessageMutation: () => ({
    mutateAsync: mockSendMessage,
    isPending: mockSendMutationState.isPending,
  }),
  useCreatePrivacyRoomLinkMutation: () => ({
    mutateAsync: mockCreatePrivacyLink,
    isPending: mockPrivacyMutationState.isPending,
  }),
  useCreatePersonalChatRealtimeSessionMutation: () => ({
    mutateAsync: mockCreateRealtimeSession,
  }),
  usePersonalLogoutMutation: () => ({
    mutateAsync: mockLogout,
    isPending: mockLogoutMutationState.isPending,
  }),
}))

describe("PersonalConversation", () => {
  beforeEach(() => {
    mockReplace.mockReset()
    mockLogout.mockReset()
    mockSendMessage.mockReset()
    mockCreatePrivacyLink.mockReset()
    mockCreateRealtimeSession.mockReset()
    mockLogoutMutationState.isPending = false
    mockCreateRealtimeSession.mockResolvedValue({
      provider: "gateway",
      sessionId: "gateway-rt-1",
      conversationId: "conversation-1",
      channel: "conversation:conversation-1",
      issuedAt: "2026-04-15T09:00:00.000Z",
      expiresAt: "2026-04-15T09:30:00.000Z",
    })
  })

  const renderConversation = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PersonalConversation conversationId="conversation-1" />
      </QueryClientProvider>,
    )

  it("renders the thread state and sends a message with a client message id", async () => {
    mockSendMessage.mockResolvedValueOnce({
      id: "message-2",
      kind: "text",
      conversationId: "conversation-1",
      senderId: "user-1",
      sentAt: "2026-04-15T09:15:00.000Z",
      deliveryStatus: "sent",
      clientMessageId: "client-1",
      text: "On my way.",
    })

    renderConversation()

    expect(screen.getAllByText("Delta Lane").length).toBeGreaterThan(0)
    expect(screen.getByText("Meet me in the thread.")).toBeInTheDocument()
    expect(
      screen.queryByText("Continue another direct conversation"),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Inbox" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open profile menu" })).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Privacy chat" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        "Realtime bridge is not available in this client mode yet. Sending will use direct requests.",
      ),
    ).not.toBeInTheDocument()
    expect(screen.getByText("@delta")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Open profile menu" }))

    expect(screen.getByText("Echo Vale")).toBeInTheDocument()
    expect(screen.getByText("@echo")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("Type message..."), {
      target: { value: "On my way." },
    })
    fireEvent.click(screen.getByRole("button", { name: "SEND" }))

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        text: "On my way.",
        clientMessageId: expect.any(String),
      })
    })
  })

  it("can create a privacy-room handoff", async () => {
    mockCreatePrivacyLink.mockResolvedValueOnce({
      id: "message-privacy-1",
      kind: "privacy-link",
      conversationId: "conversation-1",
      senderId: "user-1",
      sentAt: "2026-04-15T09:20:00.000Z",
      deliveryStatus: "sent",
      clientMessageId: "client-privacy-1",
      roomId: "room-1",
      roomUrl: "/private/room/room-1",
      label: "Open secure room",
    })

    renderConversation()

    fireEvent.click(screen.getByRole("button", { name: "Share Secure Room" }))

    await waitFor(() => {
      expect(mockCreatePrivacyLink).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        clientMessageId: expect.any(String),
      })
    })
  })
})
