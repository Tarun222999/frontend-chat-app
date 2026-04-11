"use client"

import {
  conversationRoomAckSchema,
  messageErrorEventSchema,
  messageNewEventSchema,
  messageSendAckSchema,
  realtimeConnectionStateSchema,
  type RealtimeConnectionState,
  type RealtimeSessionBootstrap,
} from "@/features/personal-chat/domain"
import {
  PersonalChatApiError,
  sendPersonalChatMessage,
} from "./personal-chat-api"
import type {
  JoinConversationInput,
  LeaveConversationInput,
  RealtimeAdapter,
  RealtimeAdapterConnectionListener,
  RealtimeAdapterEventMap,
  SendRealtimeMessageInput,
} from "./realtime-adapter"

const disconnectedState = (
  lastError: string | null = null,
): RealtimeConnectionState => ({
  status: "disconnected",
  lastError,
})

export class MockRealtimeAdapter implements RealtimeAdapter {
  private bootstrap: RealtimeSessionBootstrap | null = null
  private joinedConversationIds = new Set<string>()
  private connectionState: RealtimeConnectionState = {
    status: "idle",
    lastError: null,
  }
  private eventListeners: {
    [EventName in keyof RealtimeAdapterEventMap]: Set<
      (payload: RealtimeAdapterEventMap[EventName]) => void
    >
  } = {
    "message:new": new Set(),
    "message:error": new Set(),
  }
  private connectionListeners = new Set<RealtimeAdapterConnectionListener>()

  async connect(session: RealtimeSessionBootstrap) {
    this.setConnectionState({
      status: "connecting",
      lastError: null,
    })

    if (session.provider !== "mock") {
      const error = "Mock realtime adapter only supports mock sessions"
      this.setConnectionState(disconnectedState(error))
      throw new Error(error)
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      const error = "Realtime session has expired"
      this.setConnectionState(disconnectedState(error))
      throw new Error(error)
    }

    this.bootstrap = session
    this.joinedConversationIds.clear()
    this.setConnectionState({
      status: "connected",
      lastError: null,
    })
  }

  disconnect() {
    this.bootstrap = null
    this.joinedConversationIds.clear()
    this.setConnectionState(disconnectedState())
  }

  getConnectionState() {
    return this.connectionState
  }

  async joinConversation(input: JoinConversationInput) {
    if (!this.bootstrap) {
      return this.buildJoinAck({
        ok: false,
        error: "Realtime session is not connected",
      })
    }

    if (input.conversationId !== this.bootstrap.conversationId) {
      return this.buildJoinAck({
        ok: false,
        error: "Realtime session is scoped to a different conversation",
      })
    }

    this.joinedConversationIds.add(input.conversationId)

    return this.buildJoinAck({
      ok: true,
      conversationId: input.conversationId,
    })
  }

  async leaveConversation(input: LeaveConversationInput) {
    if (!this.bootstrap) {
      return this.buildJoinAck({
        ok: false,
        error: "Realtime session is not connected",
      })
    }

    if (!this.joinedConversationIds.has(input.conversationId)) {
      return this.buildJoinAck({
        ok: false,
        error: "Conversation is not joined",
      })
    }

    this.joinedConversationIds.delete(input.conversationId)

    return this.buildJoinAck({
      ok: true,
      conversationId: input.conversationId,
    })
  }

  async sendMessage(input: SendRealtimeMessageInput) {
    if (!this.bootstrap) {
      const eventPayload = this.emitSendError({
        error: "Realtime session is not connected",
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
      })
      return this.buildSendErrorAck(eventPayload)
    }

    if (!this.joinedConversationIds.has(input.conversationId)) {
      const eventPayload = this.emitSendError({
        error: "Conversation is not joined",
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
      })
      return this.buildSendErrorAck(eventPayload)
    }

    try {
      const message = await sendPersonalChatMessage({
        conversationId: input.conversationId,
        text: input.body,
        clientMessageId: input.clientMessageId,
      })

      const ack = messageSendAckSchema.parse({
        ok: true,
        conversationId: input.conversationId,
        messageId: message.id,
        clientMessageId: message.clientMessageId,
      })

      const connectedSessionId = this.bootstrap.sessionId
      queueMicrotask(() => {
        if (
          !this.bootstrap ||
          this.bootstrap.sessionId !== connectedSessionId ||
          !this.joinedConversationIds.has(input.conversationId)
        ) {
          return
        }

        this.emit("message:new", messageNewEventSchema.parse({ message }))
      })

      return ack
    } catch (error) {
      const message =
        error instanceof PersonalChatApiError ? error.message : "Message send failed"

      const eventPayload = this.emitSendError({
        error: message,
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
      })
      return this.buildSendErrorAck(eventPayload)
    }
  }

  on<EventName extends keyof RealtimeAdapterEventMap>(
    event: EventName,
    listener: (payload: RealtimeAdapterEventMap[EventName]) => void,
  ) {
    const listeners = this.eventListeners[event] as Set<
      (payload: RealtimeAdapterEventMap[EventName]) => void
    >
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }

  onConnectionStateChange(listener: RealtimeAdapterConnectionListener) {
    this.connectionListeners.add(listener)

    return () => {
      this.connectionListeners.delete(listener)
    }
  }

  private emit<EventName extends keyof RealtimeAdapterEventMap>(
    event: EventName,
    payload: RealtimeAdapterEventMap[EventName],
  ) {
    const listeners = this.eventListeners[event] as Set<
      (value: RealtimeAdapterEventMap[EventName]) => void
    >

    for (const listener of listeners) {
      listener(payload)
    }
  }

  private emitSendError(payload: RealtimeAdapterEventMap["message:error"]) {
    const eventPayload = messageErrorEventSchema.parse(payload)
    this.emit("message:error", eventPayload)
    return eventPayload
  }

  private buildSendErrorAck(payload: RealtimeAdapterEventMap["message:error"]) {
    return messageSendAckSchema.parse({
      ok: false,
      error: payload.error,
      conversationId: payload.conversationId,
      clientMessageId: payload.clientMessageId,
    })
  }

  private buildJoinAck(payload: {
    ok: boolean
    conversationId?: string
    error?: string
  }) {
    return conversationRoomAckSchema.parse(payload)
  }

  private setConnectionState(state: RealtimeConnectionState) {
    this.connectionState = realtimeConnectionStateSchema.parse(state)

    for (const listener of this.connectionListeners) {
      listener(this.connectionState)
    }
  }
}

export const createMockRealtimeAdapter = () => new MockRealtimeAdapter()
