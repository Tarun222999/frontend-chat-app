import { beforeEach, describe, expect, it, vi } from "vitest"
import { REALTIME_SEND_ACK_TIMEOUT_MS } from "./realtime-adapter"
import { createSocketIoRealtimeAdapter } from "./socketio-realtime-adapter"

type Listener = (...args: unknown[]) => void

class FakeManager {
  private listeners = new Map<string, Set<Listener>>()

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)?.add(listener)
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener)
  }

  emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args)
    }
  }
}

class FakeSocket {
  connected = false
  io = new FakeManager()
  private listeners = new Map<string, Set<Listener>>()
  lastAuth: unknown = null
  ackResponses = new Map<string, unknown>()
  emitCalls: Array<{ event: string; payload: unknown }> = []

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)?.add(listener)
    return this
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener)
    return this
  }

  connect() {
    this.connected = true
    this.emitEvent("connect")
    return this
  }

  disconnect() {
    this.connected = false
    this.emitEvent("disconnect", "io client disconnect")
    return this
  }

  emit(event: string, payload: unknown, ack?: (value: unknown) => void) {
    this.emitCalls.push({ event, payload })

    if (ack && this.ackResponses.has(event)) {
      ack(this.ackResponses.get(event))
    }

    return this
  }

  emitEvent(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args)
    }
  }
}

const { mockIo } = vi.hoisted(() => ({
  mockIo: vi.fn(),
}))

vi.mock("socket.io-client", () => ({
  io: mockIo,
}))

describe("SocketIoRealtimeAdapter", () => {
  let fakeSocket: FakeSocket

  beforeEach(() => {
    fakeSocket = new FakeSocket()
    mockIo.mockReset()
    mockIo.mockImplementation((socketUrl: string, options: unknown) => {
      fakeSocket.lastAuth = {
        socketUrl,
        options,
      }

      return fakeSocket
    })
  })

  it("connects with the gateway session access token", async () => {
    const adapter = createSocketIoRealtimeAdapter()

    await adapter.connect({
      provider: "gateway",
      sessionId: "gateway-rt-1",
      conversationId: "conversation-1",
      issuedAt: "2026-04-21T08:00:00.000Z",
      expiresAt: "2099-04-21T09:00:00.000Z",
      socketUrl: "http://localhost:4002",
      accessToken: "access-token-1",
    })

    expect(adapter.getConnectionState()).toEqual({
      status: "connected",
      lastError: null,
    })
    expect(fakeSocket.lastAuth).toEqual({
      socketUrl: "http://localhost:4002",
      options: {
        autoConnect: false,
        auth: {
          token: "access-token-1",
        },
        transports: ["websocket"],
      },
    })
  })

  it("disconnects and updates the connection state", async () => {
    const adapter = createSocketIoRealtimeAdapter()

    await adapter.connect({
      provider: "gateway",
      sessionId: "gateway-rt-1",
      conversationId: "conversation-1",
      issuedAt: "2026-04-21T08:00:00.000Z",
      expiresAt: "2099-04-21T09:00:00.000Z",
      socketUrl: "http://localhost:4002",
      accessToken: "access-token-1",
    })

    adapter.disconnect()

    expect(adapter.getConnectionState()).toEqual({
      status: "disconnected",
      lastError: null,
    })
  })

  it("returns join and leave acknowledgements", async () => {
    const adapter = createSocketIoRealtimeAdapter()
    fakeSocket.ackResponses.set("conversation:join", {
      ok: true,
      conversationId: "conversation-1",
    })
    fakeSocket.ackResponses.set("conversation:leave", {
      ok: true,
      conversationId: "conversation-1",
    })

    await adapter.connect({
      provider: "gateway",
      sessionId: "gateway-rt-1",
      conversationId: "conversation-1",
      issuedAt: "2026-04-21T08:00:00.000Z",
      expiresAt: "2099-04-21T09:00:00.000Z",
      socketUrl: "http://localhost:4002",
      accessToken: "access-token-1",
    })

    await expect(
      adapter.joinConversation({ conversationId: "conversation-1" }),
    ).resolves.toEqual({
      ok: true,
      conversationId: "conversation-1",
    })
    await expect(
      adapter.leaveConversation({ conversationId: "conversation-1" }),
    ).resolves.toEqual({
      ok: true,
      conversationId: "conversation-1",
    })
  })

  it("maps message:new payloads into chat messages", async () => {
    const adapter = createSocketIoRealtimeAdapter()
    const receivedPayloads: unknown[] = []
    const release = adapter.on("message:new", (payload) => {
      receivedPayloads.push(payload)
    })

    await adapter.connect({
      provider: "gateway",
      sessionId: "gateway-rt-1",
      conversationId: "conversation-1",
      issuedAt: "2026-04-21T08:00:00.000Z",
      expiresAt: "2099-04-21T09:00:00.000Z",
      socketUrl: "http://localhost:4002",
      accessToken: "access-token-1",
    })

    fakeSocket.emitEvent("message:new", {
      message: {
        id: "message-1",
        conversationId: "conversation-1",
        senderId: "user-2",
        body: "hello",
        createdAt: "2026-04-21T08:01:00.000Z",
        reactions: [],
      },
    })

    expect(receivedPayloads).toEqual([
      {
        message: {
          id: "message-1",
          kind: "text",
          conversationId: "conversation-1",
          senderId: "user-2",
          text: "hello",
          sentAt: "2026-04-21T08:01:00.000Z",
          deliveryStatus: "sent",
        },
      },
    ])

    release()
  })

  it("maps secure-room handoff payloads with key fragments", async () => {
    const adapter = createSocketIoRealtimeAdapter()
    const receivedPayloads: unknown[] = []
    const release = adapter.on("message:new", (payload) => {
      receivedPayloads.push(payload)
    })

    await adapter.connect({
      provider: "gateway",
      sessionId: "gateway-rt-1",
      conversationId: "conversation-1",
      issuedAt: "2026-04-21T08:00:00.000Z",
      expiresAt: "2099-04-21T09:00:00.000Z",
      socketUrl: "http://localhost:4002",
      accessToken: "access-token-1",
    })

    fakeSocket.emitEvent("message:new", {
      message: {
        id: "message-privacy-1",
        conversationId: "conversation-1",
        senderId: "user-2",
        body:
          "Secure room: /private/room/room-1#1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        createdAt: "2026-04-21T08:01:00.000Z",
        reactions: [],
      },
    })

    expect(receivedPayloads).toEqual([
      {
        message: {
          id: "message-privacy-1",
          kind: "privacy-link",
          conversationId: "conversation-1",
          senderId: "user-2",
          roomId: "room-1",
          roomUrl:
            "/private/room/room-1#1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          label: "Open secure room",
          sentAt: "2026-04-21T08:01:00.000Z",
          deliveryStatus: "sent",
        },
      },
    ])

    release()
  })

  it("maps message:error payloads", async () => {
    const adapter = createSocketIoRealtimeAdapter()
    const receivedPayloads: unknown[] = []
    const release = adapter.on("message:error", (payload) => {
      receivedPayloads.push(payload)
    })

    await adapter.connect({
      provider: "gateway",
      sessionId: "gateway-rt-1",
      conversationId: "conversation-1",
      issuedAt: "2026-04-21T08:00:00.000Z",
      expiresAt: "2099-04-21T09:00:00.000Z",
      socketUrl: "http://localhost:4002",
      accessToken: "access-token-1",
    })

    fakeSocket.emitEvent("message:error", {
      error: "Message send failed",
      conversationId: "conversation-1",
      clientMessageId: "client-1",
    })

    expect(receivedPayloads).toEqual([
      {
        error: "Message send failed",
        conversationId: "conversation-1",
        clientMessageId: "client-1",
      },
    ])

    release()
  })

  it("maps reconnect lifecycle updates into connection state changes", async () => {
    const adapter = createSocketIoRealtimeAdapter()
    const states: unknown[] = []
    const release = adapter.onConnectionStateChange((state) => {
      states.push(state)
    })

    await adapter.connect({
      provider: "gateway",
      sessionId: "gateway-rt-1",
      conversationId: "conversation-1",
      issuedAt: "2026-04-21T08:00:00.000Z",
      expiresAt: "2099-04-21T09:00:00.000Z",
      socketUrl: "http://localhost:4002",
      accessToken: "access-token-1",
    })

    fakeSocket.io.emit("reconnect_attempt")
    fakeSocket.emitEvent("connect")
    fakeSocket.io.emit("reconnect_attempt")
    fakeSocket.io.emit("reconnect_failed")

    expect(states).toContainEqual({
      status: "reconnecting",
      lastError: null,
    })
    expect(states).toContainEqual({
      status: "connected",
      lastError: null,
    })
    expect(states).toContainEqual({
      status: "error",
      lastError: "Realtime reconnection failed",
    })

    release()
  })

  it("returns a failed send acknowledgement when the realtime session is not connected", async () => {
    const adapter = createSocketIoRealtimeAdapter()

    await expect(
      adapter.sendMessage({
        conversationId: "conversation-1",
        body: "hello",
        clientMessageId: "client-1",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Realtime session is not connected",
      conversationId: "conversation-1",
      clientMessageId: "client-1",
    })
  })

  it("returns the server send acknowledgement payload", async () => {
    const adapter = createSocketIoRealtimeAdapter()
    fakeSocket.ackResponses.set("message:send", {
      ok: true,
      conversationId: "conversation-1",
      messageId: "message-1",
      clientMessageId: "client-1",
    })

    await adapter.connect({
      provider: "gateway",
      sessionId: "gateway-rt-1",
      conversationId: "conversation-1",
      issuedAt: "2026-04-21T08:00:00.000Z",
      expiresAt: "2099-04-21T09:00:00.000Z",
      socketUrl: "http://localhost:4002",
      accessToken: "access-token-1",
    })

    await expect(
      adapter.sendMessage({
        conversationId: "conversation-1",
        body: "hello",
        clientMessageId: "client-1",
      }),
    ).resolves.toEqual({
      ok: true,
      conversationId: "conversation-1",
      messageId: "message-1",
      clientMessageId: "client-1",
    })
  })

  it("returns a failed acknowledgement when message:send times out", async () => {
    vi.useFakeTimers()
    const adapter = createSocketIoRealtimeAdapter()

    await adapter.connect({
      provider: "gateway",
      sessionId: "gateway-rt-1",
      conversationId: "conversation-1",
      issuedAt: "2026-04-21T08:00:00.000Z",
      expiresAt: "2099-04-21T09:00:00.000Z",
      socketUrl: "http://localhost:4002",
      accessToken: "access-token-1",
    })

    const sendPromise = adapter.sendMessage({
      conversationId: "conversation-1",
      body: "hello",
      clientMessageId: "client-1",
    })

    await vi.advanceTimersByTimeAsync(REALTIME_SEND_ACK_TIMEOUT_MS)

    await expect(sendPromise).resolves.toEqual({
      ok: false,
      error: `Realtime message:send timed out after ${REALTIME_SEND_ACK_TIMEOUT_MS}ms`,
      conversationId: "conversation-1",
      clientMessageId: "client-1",
    })

    vi.useRealTimers()
  })
})
