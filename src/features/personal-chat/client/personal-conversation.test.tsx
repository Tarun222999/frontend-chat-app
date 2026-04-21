import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
  ConversationDetail,
  ConversationSummary,
  RealtimeConnectionState,
  RealtimeSessionBootstrap,
  TextChatMessage,
} from "@/features/personal-chat/domain"
import { PersonalConversation } from "./personal-conversation"
import { personalChatQueryKeys } from "./query-keys"
import type { RealtimeAdapter, RealtimeAdapterEventMap } from "./realtime-adapter"

type RealtimeAdapterDouble = RealtimeAdapter & {
  emitEvent: <EventName extends keyof RealtimeAdapterEventMap>(
    event: EventName,
    payload: RealtimeAdapterEventMap[EventName],
  ) => void
  emitConnectionState: (state: RealtimeConnectionState) => void
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  getConnectionState: ReturnType<typeof vi.fn>
  joinConversation: ReturnType<typeof vi.fn>
  leaveConversation: ReturnType<typeof vi.fn>
  sendMessage: ReturnType<typeof vi.fn>
}

const createRealtimeAdapterDouble = (): RealtimeAdapterDouble => {
  let connectionState: RealtimeConnectionState = {
    status: "idle",
    lastError: null,
  }
  const eventListeners: {
    [EventName in keyof RealtimeAdapterEventMap]: Set<
      (payload: RealtimeAdapterEventMap[EventName]) => void
    >
  } = {
    "message:new": new Set(),
    "message:error": new Set(),
  }
  let connectionListener:
    | ((state: RealtimeConnectionState) => void)
    | null = null

  const adapter = {
    connect: vi.fn(async () => {
      connectionState = {
        status: "connected",
        lastError: null,
      }
      connectionListener?.(connectionState)
    }),
    disconnect: vi.fn(() => {
      connectionState = {
        status: "disconnected",
        lastError: null,
      }
    }),
    getConnectionState: vi.fn(() => connectionState),
    joinConversation: vi.fn(async ({ conversationId }: { conversationId: string }) => ({
      ok: true,
      conversationId,
    })),
    leaveConversation: vi.fn(async ({ conversationId }: { conversationId: string }) => ({
      ok: true,
      conversationId,
    })),
    sendMessage: vi.fn(),
    on: vi.fn(
      <EventName extends keyof RealtimeAdapterEventMap>(
        event: EventName,
        listener: (payload: RealtimeAdapterEventMap[EventName]) => void,
      ) => {
        const listeners = eventListeners[event] as Set<
          (payload: RealtimeAdapterEventMap[EventName]) => void
        >
        listeners.add(listener)

        return () => {
          listeners.delete(listener)
        }
      },
    ),
    onConnectionStateChange: vi.fn((listener: (state: RealtimeConnectionState) => void) => {
      connectionListener = listener

      return () => {
        if (connectionListener === listener) {
          connectionListener = null
        }
      }
    }),
    emitConnectionState: (state: RealtimeConnectionState) => {
      connectionState = state
      connectionListener?.(state)
    },
    emitEvent: <EventName extends keyof RealtimeAdapterEventMap>(
      event: EventName,
      payload: RealtimeAdapterEventMap[EventName],
    ) => {
      const listeners = eventListeners[event] as Set<
        (value: RealtimeAdapterEventMap[EventName]) => void
      >

      for (const listener of listeners) {
        listener(payload as never)
      }
    },
  }

  return adapter as unknown as RealtimeAdapterDouble
}

const textMessage = (overrides?: Partial<TextChatMessage>): TextChatMessage => ({
  id: "message-1",
  kind: "text",
  conversationId: "conversation-1",
  senderId: "user-2",
  sentAt: "2026-04-15T08:30:00.000Z",
  deliveryStatus: "sent",
  text: "Meet me in the thread.",
  ...overrides,
})

const buildConversationDetail = (
  overrides?: Partial<ConversationDetail>,
): ConversationDetail => ({
  id: "conversation-1",
  participant: {
    id: "user-2",
    handle: "delta",
    displayName: "Delta Lane",
    avatarUrl: null,
  },
  messages: [textMessage()],
  hasMoreHistory: false,
  ...overrides,
})

const buildConversationSummary = (
  overrides?: Partial<ConversationSummary>,
): ConversationSummary => ({
  id: "conversation-1",
  participant: {
    id: "user-2",
    handle: "delta",
    displayName: "Delta Lane",
    avatarUrl: null,
  },
  lastMessagePreview: "Meet me in the thread.",
  lastMessageAt: "2026-04-15T08:30:00.000Z",
  unreadCount: 0,
  ...overrides,
})

const buildGatewayBootstrap = (
  conversationId: string = "conversation-1",
): RealtimeSessionBootstrap => ({
  provider: "gateway",
  sessionId: `gateway-rt-${conversationId}`,
  conversationId,
  issuedAt: "2026-04-15T09:00:00.000Z",
  expiresAt: "2026-04-15T09:30:00.000Z",
  socketUrl: "http://localhost:4002",
  accessToken: "access-token-1",
})

const buildMockBootstrap = (
  conversationId: string = "conversation-1",
): RealtimeSessionBootstrap => ({
  provider: "mock",
  sessionId: `mock-rt-${conversationId}`,
  conversationId,
  channel: `conversation:${conversationId}`,
  issuedAt: "2026-04-15T09:00:00.000Z",
  expiresAt: "2026-04-15T09:30:00.000Z",
})

const {
  mockReplace,
  mockLogout,
  mockSendMessage,
  mockCreatePrivacyLink,
  mockCreateRealtimeSession,
  mockCreateMockRealtimeAdapter,
  mockCreateSocketIoRealtimeAdapter,
  createdMockAdapters,
  createdSocketAdapters,
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
  mockCreateMockRealtimeAdapter: vi.fn(),
  mockCreateSocketIoRealtimeAdapter: vi.fn(),
  createdMockAdapters: [] as RealtimeAdapterDouble[],
  createdSocketAdapters: [] as RealtimeAdapterDouble[],
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

vi.mock("./mock-realtime-adapter", () => ({
  createMockRealtimeAdapter: mockCreateMockRealtimeAdapter,
}))

vi.mock("./socketio-realtime-adapter", () => ({
  createSocketIoRealtimeAdapter: mockCreateSocketIoRealtimeAdapter,
}))

describe("PersonalConversation", () => {
  const seedConversationCaches = (
    client: QueryClient,
    input?: {
      conversation?: ConversationDetail
      summaries?: ConversationSummary[]
    },
  ) => {
    if (input?.conversation) {
      client.setQueryData(
        personalChatQueryKeys.conversationDetail(input.conversation.id),
        input.conversation,
      )
    }

    if (input?.summaries) {
      client.setQueryData(personalChatQueryKeys.conversations(), input.summaries)
    }
  }

  const renderConversation = (
    conversationId: string = "conversation-1",
    seed?: {
      conversation?: ConversationDetail
      summaries?: ConversationSummary[]
    },
  ) => {
    const client = new QueryClient()
    seedConversationCaches(client, seed)
    const view = render(
      <QueryClientProvider client={client}>
        <PersonalConversation conversationId={conversationId} />
      </QueryClientProvider>,
    )

    return {
      ...view,
      client,
    }
  }

  beforeEach(() => {
    mockReplace.mockReset()
    mockLogout.mockReset()
    mockSendMessage.mockReset()
    mockCreatePrivacyLink.mockReset()
    mockCreateRealtimeSession.mockReset()
    mockCreateMockRealtimeAdapter.mockReset()
    mockCreateSocketIoRealtimeAdapter.mockReset()
    createdMockAdapters.length = 0
    createdSocketAdapters.length = 0
    mockLogoutMutationState.isPending = false

    mockCreateRealtimeSession.mockImplementation(
      async ({ conversationId }: { conversationId: string }) =>
        buildGatewayBootstrap(conversationId),
    )
    mockCreateMockRealtimeAdapter.mockImplementation(() => {
      const adapter = createRealtimeAdapterDouble()
      createdMockAdapters.push(adapter)
      return adapter
    })
    mockCreateSocketIoRealtimeAdapter.mockImplementation(() => {
      const adapter = createRealtimeAdapterDouble()
      createdSocketAdapters.push(adapter)
      return adapter
    })
  })

  it("sends messages through realtime when the thread is connected and joined", async () => {
    renderConversation()

    await waitFor(() => {
      expect(createdSocketAdapters).toHaveLength(1)
    })

    const gatewayAdapter = createdSocketAdapters[0]

    await waitFor(() => {
      expect(gatewayAdapter.connect).toHaveBeenCalledWith(
        buildGatewayBootstrap("conversation-1"),
      )
      expect(gatewayAdapter.joinConversation).toHaveBeenCalledWith({
        conversationId: "conversation-1",
      })
      expect(screen.getByText("Connected")).toBeInTheDocument()
    })

    expect(createdMockAdapters).toHaveLength(0)
    expect(screen.getByText("@delta")).toBeInTheDocument()

    gatewayAdapter.sendMessage.mockImplementationOnce(
      async ({ conversationId, clientMessageId, body }) => ({
        ok: true,
        conversationId,
        messageId: "message-2",
        clientMessageId,
        body,
      }),
    )

    fireEvent.change(screen.getByPlaceholderText("Type message..."), {
      target: { value: "On my way." },
    })
    fireEvent.click(screen.getByRole("button", { name: "SEND" }))

    await waitFor(() => {
      expect(gatewayAdapter.sendMessage).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        body: "On my way.",
        clientMessageId: expect.any(String),
      })
    })

    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it("uses the mock adapter when the realtime bootstrap provider is mock", async () => {
    mockCreateRealtimeSession.mockResolvedValueOnce(buildMockBootstrap("conversation-1"))

    renderConversation()

    await waitFor(() => {
      expect(createdMockAdapters).toHaveLength(1)
    })

    expect(createdSocketAdapters).toHaveLength(0)
    expect(createdMockAdapters[0]?.joinConversation).toHaveBeenCalledWith({
      conversationId: "conversation-1",
    })
  })

  it("keeps the header in Connecting until the conversation join succeeds", async () => {
    let resolveJoin:
      | ((value: { ok: true; conversationId: string }) => void)
      | undefined
    const adapter = createRealtimeAdapterDouble()

    adapter.joinConversation.mockImplementation(
      () =>
        new Promise<{ ok: true; conversationId: string }>((resolve) => {
          resolveJoin = resolve
        }),
    )

    mockCreateSocketIoRealtimeAdapter.mockImplementationOnce(() => {
      createdSocketAdapters.push(adapter)
      return adapter
    })

    renderConversation()

    await waitFor(() => {
      expect(adapter.connect).toHaveBeenCalled()
    })

    expect(screen.getByText("Connecting")).toBeInTheDocument()

    resolveJoin?.({
      ok: true,
      conversationId: "conversation-1",
    })

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument()
    })
  })

  it("cleans up the previous realtime thread when switching conversations", async () => {
    const view = renderConversation("conversation-1")

    await waitFor(() => {
      expect(createdSocketAdapters).toHaveLength(1)
    })

    const firstAdapter = createdSocketAdapters[0]

    view.rerender(
      <QueryClientProvider client={view.client}>
        <PersonalConversation conversationId="conversation-2" />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(createdSocketAdapters).toHaveLength(2)
    })

    const secondAdapter = createdSocketAdapters[1]

    await waitFor(() => {
      expect(firstAdapter.leaveConversation).toHaveBeenCalledWith({
        conversationId: "conversation-1",
      })
      expect(firstAdapter.disconnect).toHaveBeenCalled()
      expect(secondAdapter.joinConversation).toHaveBeenCalledWith({
        conversationId: "conversation-2",
      })
    })
  })

  it("cleans up the active realtime thread on unmount", async () => {
    const view = renderConversation()

    await waitFor(() => {
      expect(createdSocketAdapters).toHaveLength(1)
    })

    const gatewayAdapter = createdSocketAdapters[0]

    view.unmount()

    await waitFor(() => {
      expect(gatewayAdapter.leaveConversation).toHaveBeenCalledWith({
        conversationId: "conversation-1",
      })
      expect(gatewayAdapter.disconnect).toHaveBeenCalled()
    })
  })

  it("updates the header indicator for reconnecting and error states", async () => {
    renderConversation()

    await waitFor(() => {
      expect(createdSocketAdapters).toHaveLength(1)
      expect(screen.getByText("Connected")).toBeInTheDocument()
    })

    const gatewayAdapter = createdSocketAdapters[0]

    gatewayAdapter.emitConnectionState({
      status: "reconnecting",
      lastError: null,
    })

    await waitFor(() => {
      expect(screen.getByText("Reconnecting")).toBeInTheDocument()
    })

    gatewayAdapter.emitConnectionState({
      status: "error",
      lastError: "Realtime reconnection failed",
    })

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument()
      expect(screen.getByText("Realtime reconnection failed")).toBeInTheDocument()
    })
  })

  it("falls back to HTTP send when realtime is unavailable before emit", async () => {
    mockSendMessage.mockResolvedValueOnce({
      id: "message-2",
      kind: "text",
      conversationId: "conversation-1",
      senderId: "user-1",
      sentAt: "2026-04-15T09:15:00.000Z",
      deliveryStatus: "sent",
      clientMessageId: "client-1",
      text: "Fallback HTTP send",
    })

    renderConversation()

    await waitFor(() => {
      expect(createdSocketAdapters).toHaveLength(1)
      expect(screen.getByText("Connected")).toBeInTheDocument()
    })

    const gatewayAdapter = createdSocketAdapters[0]

    gatewayAdapter.emitConnectionState({
      status: "reconnecting",
      lastError: null,
    })

    await waitFor(() => {
      expect(screen.getByText("Reconnecting")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText("Type message..."), {
      target: { value: "Fallback HTTP send" },
    })
    fireEvent.click(screen.getByRole("button", { name: "SEND" }))

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        text: "Fallback HTTP send",
        clientMessageId: expect.any(String),
      })
    })

    expect(gatewayAdapter.sendMessage).not.toHaveBeenCalled()
  })

  it("marks the optimistic message failed and does not retry over HTTP after realtime ack failure", async () => {
    const seededConversation = buildConversationDetail()
    const seededSummary = buildConversationSummary()
    const view = renderConversation("conversation-1", {
      conversation: seededConversation,
      summaries: [seededSummary],
    })

    await waitFor(() => {
      expect(createdSocketAdapters).toHaveLength(1)
      expect(screen.getByText("Connected")).toBeInTheDocument()
    })

    const gatewayAdapter = createdSocketAdapters[0]

    gatewayAdapter.sendMessage.mockImplementationOnce(
      async ({ conversationId, clientMessageId }) => ({
        ok: false,
        error: "Realtime send failed",
        conversationId,
        clientMessageId,
      }),
    )

    fireEvent.change(screen.getByPlaceholderText("Type message..."), {
      target: { value: "Socket-only failure" },
    })
    fireEvent.click(screen.getByRole("button", { name: "SEND" }))

    await waitFor(() => {
      expect(gatewayAdapter.sendMessage).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        body: "Socket-only failure",
        clientMessageId: expect.any(String),
      })
    })

    expect(mockSendMessage).not.toHaveBeenCalled()

    const clientMessageId = gatewayAdapter.sendMessage.mock.calls[0]?.[0]
      ?.clientMessageId as string

    await waitFor(() => {
      expect(
        view.client.getQueryData<ConversationDetail>(
          personalChatQueryKeys.conversationDetail("conversation-1"),
        )?.messages.at(-1),
      ).toEqual({
        id: `pending-${clientMessageId}`,
        kind: "text",
        conversationId: "conversation-1",
        senderId: "user-1",
        sentAt: expect.any(String),
        deliveryStatus: "failed",
        clientMessageId,
        text: "Socket-only failure",
      })
      expect(screen.getByText("Realtime send failed")).toBeInTheDocument()
    })
  })

  it("reconciles incoming message:new events into the active thread cache and inbox summary", async () => {
    const seededConversation = buildConversationDetail()
    const seededSummary = buildConversationSummary()
    const view = renderConversation("conversation-1", {
      conversation: seededConversation,
      summaries: [seededSummary],
    })

    await waitFor(() => {
      expect(createdSocketAdapters).toHaveLength(1)
    })

    const gatewayAdapter = createdSocketAdapters[0]

    gatewayAdapter.sendMessage.mockImplementationOnce(
      async ({ conversationId, clientMessageId }) => ({
        ok: true,
        conversationId,
        messageId: "message-2",
        clientMessageId,
      }),
    )

    fireEvent.change(screen.getByPlaceholderText("Type message..."), {
      target: { value: "On my way." },
    })
    fireEvent.click(screen.getByRole("button", { name: "SEND" }))

    await waitFor(() => {
      expect(gatewayAdapter.sendMessage).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        body: "On my way.",
        clientMessageId: expect.any(String),
      })
    })

    const clientMessageId = gatewayAdapter.sendMessage.mock.calls[0]?.[0]
      ?.clientMessageId as string

    gatewayAdapter.emitEvent("message:new", {
      message: {
        id: "message-2",
        kind: "text",
        conversationId: "conversation-1",
        senderId: "user-1",
        sentAt: "2026-04-15T09:15:00.000Z",
        deliveryStatus: "sent",
        clientMessageId,
        text: "On my way.",
      },
    })

    await waitFor(() => {
      expect(
        view.client.getQueryData<ConversationDetail>(
          personalChatQueryKeys.conversationDetail("conversation-1"),
        )?.messages,
      ).toEqual([
        textMessage(),
        {
          id: "message-2",
          kind: "text",
          conversationId: "conversation-1",
          senderId: "user-1",
          sentAt: "2026-04-15T09:15:00.000Z",
          deliveryStatus: "sent",
          clientMessageId,
          text: "On my way.",
        },
      ])
      expect(
        view.client.getQueryData<ConversationSummary[]>(
          personalChatQueryKeys.conversations(),
        ),
      ).toEqual([
        {
          ...seededSummary,
          lastMessagePreview: "On my way.",
          lastMessageAt: "2026-04-15T09:15:00.000Z",
        },
      ])
    })
  })

  it("ignores incoming realtime events for other conversations", async () => {
    const seededConversation = buildConversationDetail()
    const seededSummary = buildConversationSummary()
    const view = renderConversation("conversation-1", {
      conversation: seededConversation,
      summaries: [seededSummary],
    })

    await waitFor(() => {
      expect(createdSocketAdapters).toHaveLength(1)
    })

    const gatewayAdapter = createdSocketAdapters[0]

    gatewayAdapter.emitEvent("message:new", {
      message: {
        id: "message-foreign",
        kind: "text",
        conversationId: "conversation-2",
        senderId: "user-9",
        sentAt: "2026-04-15T09:20:00.000Z",
        deliveryStatus: "sent",
        text: "Wrong thread",
      },
    })
    gatewayAdapter.emitEvent("message:error", {
      error: "Wrong thread error",
      conversationId: "conversation-2",
      clientMessageId: "client-foreign",
    })

    await waitFor(() => {
      expect(
        view.client.getQueryData<ConversationDetail>(
          personalChatQueryKeys.conversationDetail("conversation-1"),
        ),
      ).toEqual(seededConversation)
      expect(
        view.client.getQueryData<ConversationSummary[]>(
          personalChatQueryKeys.conversations(),
        ),
      ).toEqual([seededSummary])
    })

    expect(screen.queryByText("Wrong thread error")).not.toBeInTheDocument()
  })

  it("marks matched pending optimistic messages failed on message:error and surfaces unmatched errors", async () => {
    const seededConversation = buildConversationDetail()
    const seededSummary = buildConversationSummary()
    const view = renderConversation("conversation-1", {
      conversation: seededConversation,
      summaries: [seededSummary],
    })

    await waitFor(() => {
      expect(createdSocketAdapters).toHaveLength(1)
    })

    const gatewayAdapter = createdSocketAdapters[0]

    gatewayAdapter.sendMessage.mockImplementationOnce(
      async ({ conversationId, clientMessageId }) => ({
        ok: true,
        conversationId,
        messageId: "message-pending",
        clientMessageId,
      }),
    )

    fireEvent.change(screen.getByPlaceholderText("Type message..."), {
      target: { value: "This might fail." },
    })
    fireEvent.click(screen.getByRole("button", { name: "SEND" }))

    await waitFor(() => {
      expect(gatewayAdapter.sendMessage).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        body: "This might fail.",
        clientMessageId: expect.any(String),
      })
    })

    const clientMessageId = gatewayAdapter.sendMessage.mock.calls[0]?.[0]
      ?.clientMessageId as string

    await waitFor(() => {
      expect(
        view.client.getQueryData<ConversationDetail>(
          personalChatQueryKeys.conversationDetail("conversation-1"),
        )?.messages.at(-1),
      ).toEqual({
        id: `pending-${clientMessageId}`,
        kind: "text",
        conversationId: "conversation-1",
        senderId: "user-1",
        sentAt: expect.any(String),
        deliveryStatus: "pending",
        clientMessageId,
        text: "This might fail.",
      })
    })

    gatewayAdapter.emitEvent("message:error", {
      error: "Message send failed",
      conversationId: "conversation-1",
      clientMessageId,
    })

    await waitFor(() => {
      expect(
        view.client.getQueryData<ConversationDetail>(
          personalChatQueryKeys.conversationDetail("conversation-1"),
        )?.messages.at(-1),
      ).toEqual({
        id: `pending-${clientMessageId}`,
        kind: "text",
        conversationId: "conversation-1",
        senderId: "user-1",
        sentAt: expect.any(String),
        deliveryStatus: "failed",
        clientMessageId,
        text: "This might fail.",
      })
    })

    expect(screen.queryByText("Message send failed")).not.toBeInTheDocument()

    gatewayAdapter.emitEvent("message:error", {
      error: "Unmatched thread error",
      conversationId: "conversation-1",
      clientMessageId: "client-missing",
    })

    expect(await screen.findByText("Unmatched thread error")).toBeInTheDocument()
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
