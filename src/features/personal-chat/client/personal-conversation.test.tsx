import type { InfiniteData } from "@tanstack/react-query"
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
  mockPreparePrivacyRoomDraft,
  mockCreateRealtimeSession,
  mockGetConversationDetail,
  mockCreateMockRealtimeAdapter,
  mockCreateSocketIoRealtimeAdapter,
  createdMockAdapters,
  createdSocketAdapters,
  mockSessionQuery,
  mockConversationDetailQuery,
  mockSendMutationState,
  mockPrivacyMutationState,
  mockPreparePrivacyRoomDraftMutationState,
  mockLogoutMutationState,
} = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockLogout: vi.fn(),
  mockSendMessage: vi.fn(),
  mockCreatePrivacyLink: vi.fn(),
  mockPreparePrivacyRoomDraft: vi.fn(),
  mockCreateRealtimeSession: vi.fn(),
  mockGetConversationDetail: vi.fn(),
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
    } as ConversationDetail,
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
  mockPreparePrivacyRoomDraftMutationState: {
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

vi.mock("./hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./hooks")>()

  return {
    ...actual,
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
    usePreparePrivacyRoomDraftMutation: () => ({
      mutateAsync: mockPreparePrivacyRoomDraft,
      isPending: mockPreparePrivacyRoomDraftMutationState.isPending,
    }),
    useCreatePersonalChatRealtimeSessionMutation: () => ({
      mutateAsync: mockCreateRealtimeSession,
    }),
    usePersonalLogoutMutation: () => ({
      mutateAsync: mockLogout,
      isPending: mockLogoutMutationState.isPending,
    }),
  }
})

vi.mock("./mock-realtime-adapter", () => ({
  createMockRealtimeAdapter: mockCreateMockRealtimeAdapter,
}))

vi.mock("./socketio-realtime-adapter", () => ({
  createSocketIoRealtimeAdapter: mockCreateSocketIoRealtimeAdapter,
}))

vi.mock("./personal-chat-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./personal-chat-api")>()

  return {
    ...actual,
    getConversationDetail: mockGetConversationDetail,
  }
})

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
      client.setQueryData<
        InfiniteData<ConversationDetail, { limit: number; before?: string }>
      >(
        personalChatQueryKeys.conversationHistory(input.conversation.id, 40),
        {
          pages: [input.conversation],
          pageParams: [{ limit: 40 }],
        },
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
    seedConversationCaches(client, {
      conversation: seed?.conversation ?? mockConversationDetailQuery.data,
      summaries: seed?.summaries,
    })
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
    mockPreparePrivacyRoomDraft.mockReset()
    mockCreateRealtimeSession.mockReset()
    mockGetConversationDetail.mockReset()
    mockCreateMockRealtimeAdapter.mockReset()
    mockCreateSocketIoRealtimeAdapter.mockReset()
    createdMockAdapters.length = 0
    createdSocketAdapters.length = 0
    mockLogoutMutationState.isPending = false
    mockConversationDetailQuery.data = buildConversationDetail()
    mockConversationDetailQuery.isPending = false
    mockConversationDetailQuery.isError = false
    mockConversationDetailQuery.error = null
    mockGetConversationDetail.mockImplementation(async () => mockConversationDetailQuery.data)

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

  it("loads older history when the viewport reaches the top", async () => {
    mockConversationDetailQuery.data = buildConversationDetail({
      hasMoreHistory: true,
      messages: [
        textMessage({
          id: "message-4",
          sentAt: "2026-04-15T08:34:00.000Z",
          text: "Latest page oldest",
        }),
        textMessage({
          id: "message-5",
          sentAt: "2026-04-15T08:35:00.000Z",
          text: "Latest page newest",
        }),
      ],
    })
    mockGetConversationDetail.mockResolvedValueOnce(
      buildConversationDetail({
        hasMoreHistory: false,
        messages: [
          textMessage({
            id: "message-2",
            sentAt: "2026-04-15T08:32:00.000Z",
            text: "Older page oldest",
          }),
          textMessage({
            id: "message-3",
            sentAt: "2026-04-15T08:33:00.000Z",
            text: "Older page newest",
          }),
        ],
      }),
    )

    renderConversation()

    const viewport = screen.getByTestId("conversation-message-viewport")

    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      get: () => 1200,
    })
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      get: () => 500,
    })
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    })

    fireEvent.scroll(viewport)

    await waitFor(() => {
      expect(mockGetConversationDetail).toHaveBeenCalledWith("conversation-1", {
        limit: 40,
        before: "message-4",
      })
    })

    expect(await screen.findByText("Older page oldest")).toBeInTheDocument()
    expect(screen.getByText("Older page newest")).toBeInTheDocument()
    expect(screen.getByText("Latest page oldest")).toBeInTheDocument()
    expect(screen.getByText("Latest page newest")).toBeInTheDocument()
  })

  it("preserves the viewport anchor when older history is prepended", async () => {
    let resolveOlderPage:
      | ((value: ConversationDetail) => void)
      | undefined

    mockConversationDetailQuery.data = buildConversationDetail({
      hasMoreHistory: true,
      messages: [
        textMessage({
          id: "message-4",
          sentAt: "2026-04-15T08:34:00.000Z",
          text: "Latest page oldest",
        }),
        textMessage({
          id: "message-5",
          sentAt: "2026-04-15T08:35:00.000Z",
          text: "Latest page newest",
        }),
      ],
    })
    mockGetConversationDetail.mockImplementationOnce(
      () =>
        new Promise<ConversationDetail>((resolve) => {
          resolveOlderPage = resolve
        }),
    )

    renderConversation()

    const viewport = screen.getByTestId("conversation-message-viewport")
    let scrollHeight = 1000

    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    })
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      get: () => 500,
    })
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      writable: true,
      value: 48,
    })

    fireEvent.scroll(viewport)

    await waitFor(() => {
      expect(mockGetConversationDetail).toHaveBeenCalledTimes(1)
    })

    scrollHeight = 1480

    resolveOlderPage?.(
      buildConversationDetail({
        hasMoreHistory: false,
        messages: [
          textMessage({
            id: "message-2",
            sentAt: "2026-04-15T08:32:00.000Z",
            text: "Older page oldest",
          }),
          textMessage({
            id: "message-3",
            sentAt: "2026-04-15T08:33:00.000Z",
            text: "Older page newest",
          }),
        ],
      }),
    )

    await waitFor(() => {
      expect(screen.getByText("Older page oldest")).toBeInTheDocument()
    })

    expect(viewport.scrollTop).toBe(528)
  })

  it("treats duplicate older-history pages as exhausted and stops refetching", async () => {
    mockConversationDetailQuery.data = buildConversationDetail({
      hasMoreHistory: true,
      messages: [
        textMessage({
          id: "message-4",
          sentAt: "2026-04-15T08:34:00.000Z",
          text: "Latest page oldest",
        }),
        textMessage({
          id: "message-5",
          sentAt: "2026-04-15T08:35:00.000Z",
          text: "Latest page newest",
        }),
      ],
    })
    mockGetConversationDetail.mockResolvedValueOnce(
      buildConversationDetail({
        hasMoreHistory: true,
        messages: [
          textMessage({
            id: "message-4",
            sentAt: "2026-04-15T08:34:00.000Z",
            text: "Latest page oldest",
          }),
          textMessage({
            id: "message-5",
            sentAt: "2026-04-15T08:35:00.000Z",
            text: "Latest page newest",
          }),
        ],
      }),
    )

    const view = renderConversation()
    const viewport = screen.getByTestId("conversation-message-viewport")

    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      get: () => 1200,
    })
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      get: () => 500,
    })
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    })

    fireEvent.scroll(viewport)

    await waitFor(() => {
      expect(mockGetConversationDetail).toHaveBeenCalledTimes(1)
      expect(
        view.client.getQueryData<
          InfiniteData<ConversationDetail, { limit: number; before?: string }>
        >(personalChatQueryKeys.conversationHistory("conversation-1", 40))?.pages,
      ).toHaveLength(1)
      expect(
        view.client.getQueryData<
          InfiniteData<ConversationDetail, { limit: number; before?: string }>
        >(personalChatQueryKeys.conversationHistory("conversation-1", 40))?.pages[0]
          ?.hasMoreHistory,
      ).toBe(false)
    })

    fireEvent.scroll(viewport)

    await waitFor(() => {
      expect(mockGetConversationDetail).toHaveBeenCalledTimes(1)
    })
  })

  it("sends messages through realtime when the thread is connected and joined", async () => {
    const seededConversation = buildConversationDetail()
    const view = renderConversation("conversation-1", {
      conversation: seededConversation,
      summaries: [buildConversationSummary()],
    })

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

    const clientMessageId = gatewayAdapter.sendMessage.mock.calls[0]?.[0]
      ?.clientMessageId as string

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
          sentAt: expect.any(String),
          deliveryStatus: "sent",
          clientMessageId,
          text: "On my way.",
        },
      ])
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

  it("cleans up the realtime adapter if bootstrap join throws", async () => {
    const adapter = createRealtimeAdapterDouble()

    adapter.joinConversation.mockRejectedValueOnce(new Error("Join exploded"))

    mockCreateSocketIoRealtimeAdapter.mockImplementationOnce(() => {
      createdSocketAdapters.push(adapter)
      return adapter
    })

    renderConversation()

    await waitFor(() => {
      expect(adapter.connect).toHaveBeenCalled()
      expect(adapter.joinConversation).toHaveBeenCalledWith({
        conversationId: "conversation-1",
      })
      expect(adapter.disconnect).toHaveBeenCalled()
      expect(screen.getByText("Error")).toBeInTheDocument()
      expect(
        screen.getByText("We couldn't complete that conversation action."),
      ).toBeInTheDocument()
    })

    adapter.emitConnectionState({
      status: "connected",
      lastError: null,
    })

    expect(screen.queryByText("Connected")).not.toBeInTheDocument()
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

  it("rejoins after reconnect before using realtime send again", async () => {
    let resolveRejoin:
      | ((value: { ok: true; conversationId: string }) => void)
      | undefined

    renderConversation()

    await waitFor(() => {
      expect(createdSocketAdapters).toHaveLength(1)
      expect(screen.getByText("Connected")).toBeInTheDocument()
    })

    const gatewayAdapter = createdSocketAdapters[0]

    gatewayAdapter.joinConversation.mockImplementationOnce(
      () =>
        new Promise<{ ok: true; conversationId: string }>((resolve) => {
          resolveRejoin = resolve
        }),
    )
    mockSendMessage.mockResolvedValueOnce({
      id: "message-http-fallback",
      kind: "text",
      conversationId: "conversation-1",
      senderId: "user-1",
      sentAt: "2026-04-15T09:18:00.000Z",
      deliveryStatus: "sent",
      clientMessageId: "client-http-fallback",
      text: "Fallback during reconnect",
    })

    gatewayAdapter.emitConnectionState({
      status: "reconnecting",
      lastError: null,
    })

    await waitFor(() => {
      expect(screen.getByText("Reconnecting")).toBeInTheDocument()
    })

    gatewayAdapter.emitConnectionState({
      status: "connected",
      lastError: null,
    })

    await waitFor(() => {
      expect(gatewayAdapter.joinConversation).toHaveBeenCalledTimes(2)
      expect(screen.getByText("Connecting")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText("Type message..."), {
      target: { value: "Fallback during reconnect" },
    })
    fireEvent.click(screen.getByRole("button", { name: "SEND" }))

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        text: "Fallback during reconnect",
        clientMessageId: expect.any(String),
      })
    })

    expect(gatewayAdapter.sendMessage).not.toHaveBeenCalled()

    resolveRejoin?.({
      ok: true,
      conversationId: "conversation-1",
    })

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument()
    })

    gatewayAdapter.sendMessage.mockImplementationOnce(
      async ({ conversationId, clientMessageId }) => ({
        ok: true,
        conversationId,
        messageId: "message-after-rejoin",
        clientMessageId,
      }),
    )

    fireEvent.change(screen.getByPlaceholderText("Type message..."), {
      target: { value: "Socket after rejoin" },
    })
    fireEvent.click(screen.getByRole("button", { name: "SEND" }))

    await waitFor(() => {
      expect(gatewayAdapter.sendMessage).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        body: "Socket after rejoin",
        clientMessageId: expect.any(String),
      })
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

  it("reconciles sender echoes by message id after the realtime ack upgrades the optimistic bubble", async () => {
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
        ok: true,
        conversationId,
        messageId: "message-2",
        clientMessageId,
      }),
    )

    fireEvent.change(screen.getByPlaceholderText("Type message..."), {
      target: { value: "Echo reconcile" },
    })
    fireEvent.click(screen.getByRole("button", { name: "SEND" }))

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
          sentAt: expect.any(String),
          deliveryStatus: "sent",
          clientMessageId: expect.any(String),
          text: "Echo reconcile",
        },
      ])
    })

    gatewayAdapter.emitEvent("message:new", {
      message: {
        id: "message-2",
        kind: "text",
        conversationId: "conversation-1",
        senderId: "user-1",
        sentAt: "2026-04-15T09:20:00.000Z",
        deliveryStatus: "sent",
        text: "Echo reconcile",
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
          sentAt: "2026-04-15T09:20:00.000Z",
          deliveryStatus: "sent",
          clientMessageId: expect.any(String),
          text: "Echo reconcile",
        },
      ])
    })
  })

  it("reconciles sender echoes without clientMessageId back onto the optimistic bubble", async () => {
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
        ok: true,
        conversationId,
        messageId: "message-ack-1",
        clientMessageId,
      }),
    )

    fireEvent.change(screen.getByPlaceholderText("Type message..."), {
      target: { value: "hi" },
    })
    fireEvent.click(screen.getByRole("button", { name: "SEND" }))

    await waitFor(() => {
      expect(
        view.client.getQueryData<ConversationDetail>(
          personalChatQueryKeys.conversationDetail("conversation-1"),
        )?.messages,
      ).toEqual([
        textMessage(),
        {
          id: "message-ack-1",
          kind: "text",
          conversationId: "conversation-1",
          senderId: "user-1",
          sentAt: expect.any(String),
          deliveryStatus: "sent",
          clientMessageId: expect.any(String),
          text: "hi",
        },
      ])
    })

    gatewayAdapter.emitEvent("message:new", {
      message: {
        id: "message-echo-1",
        kind: "text",
        conversationId: "conversation-1",
        senderId: "user-1",
        sentAt: "2026-04-15T09:22:00.000Z",
        deliveryStatus: "sent",
        text: "hi",
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
          id: "message-echo-1",
          kind: "text",
          conversationId: "conversation-1",
          senderId: "user-1",
          sentAt: "2026-04-15T09:22:00.000Z",
          deliveryStatus: "sent",
          clientMessageId: expect.any(String),
          text: "hi",
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
        id: "message-pending",
        kind: "text",
        conversationId: "conversation-1",
        senderId: "user-1",
        sentAt: expect.any(String),
        deliveryStatus: "sent",
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
        id: "message-pending",
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

  it("keeps realtime listeners stable across reconnect and applies one cache update after rejoin", async () => {
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

    expect(gatewayAdapter.on).toHaveBeenCalledTimes(2)
    expect(gatewayAdapter.onConnectionStateChange).toHaveBeenCalledTimes(1)

    gatewayAdapter.emitConnectionState({
      status: "reconnecting",
      lastError: null,
    })
    gatewayAdapter.emitConnectionState({
      status: "connected",
      lastError: null,
    })

    await waitFor(() => {
      expect(gatewayAdapter.joinConversation).toHaveBeenCalledTimes(2)
      expect(screen.getByText("Connected")).toBeInTheDocument()
    })

    expect(gatewayAdapter.on).toHaveBeenCalledTimes(2)
    expect(gatewayAdapter.onConnectionStateChange).toHaveBeenCalledTimes(1)

    gatewayAdapter.emitEvent("message:new", {
      message: {
        id: "message-reconnected",
        kind: "text",
        conversationId: "conversation-1",
        senderId: "user-2",
        sentAt: "2026-04-15T09:25:00.000Z",
        deliveryStatus: "sent",
        text: "Back online",
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
          id: "message-reconnected",
          kind: "text",
          conversationId: "conversation-1",
          senderId: "user-2",
          sentAt: "2026-04-15T09:25:00.000Z",
          deliveryStatus: "sent",
          text: "Back online",
        },
      ])
      expect(
        view.client.getQueryData<ConversationSummary[]>(
          personalChatQueryKeys.conversations(),
        ),
      ).toEqual([
        {
          ...seededSummary,
          lastMessagePreview: "Back online",
          lastMessageAt: "2026-04-15T09:25:00.000Z",
        },
      ])
    })
  })

  it("can create a privacy-room handoff", async () => {
    mockPreparePrivacyRoomDraft.mockResolvedValueOnce({
      roomId: "room-1",
      roomUrl:
        "/private/room/room-1#1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      label: "Open secure room",
      body:
        "Secure room: /private/room/room-1#1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    })
    const view = renderConversation()

    await waitFor(() => {
      expect(createdSocketAdapters).toHaveLength(1)
      expect(screen.getByText("Connected")).toBeInTheDocument()
    })

    const gatewayAdapter = createdSocketAdapters[0]
    gatewayAdapter.sendMessage.mockImplementationOnce(
      async ({ conversationId, clientMessageId, body }) => ({
        ok: true,
        conversationId,
        messageId: "message-privacy-1",
        clientMessageId,
        body,
      }),
    )

    const composerInput = screen.getByPlaceholderText("Type message...")
    fireEvent.click(screen.getByRole("button", { name: "Share Secure Room" }))

    await waitFor(() => {
      expect(mockPreparePrivacyRoomDraft).toHaveBeenCalledWith(
        {
          conversationId: "conversation-1",
          encryptionKey: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      )
    })

    await waitFor(() => {
      expect(gatewayAdapter.sendMessage).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        body:
          "Secure room: /private/room/room-1#1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
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
      ).toEqual(
        expect.objectContaining({
          id: "message-privacy-1",
          kind: "privacy-link",
          conversationId: "conversation-1",
          senderId: "user-1",
          deliveryStatus: "sent",
          clientMessageId,
          roomId: "room-1",
          roomUrl:
            "/private/room/room-1#1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          label: "Open secure room",
        }),
      )
    })

    await waitFor(() => {
      expect(document.activeElement).toBe(composerInput)
    })

    expect(mockSendMessage).not.toHaveBeenCalled()
  })
})
