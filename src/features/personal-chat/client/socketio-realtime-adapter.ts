"use client"

import { io } from "socket.io-client"
import { z } from "zod"
import {
  chatMessageSchema,
  conversationRoomAckSchema,
  gatewayRealtimeSessionBootstrapSchema,
  messageErrorEventSchema,
  messageNewEventSchema,
  messageSendAckSchema,
  privacyLinkMessageSchema,
  realtimeConnectionStateSchema,
  textChatMessageSchema,
  type ChatMessage,
  type RealtimeConnectionState,
  type RealtimeSessionBootstrap,
} from "@/features/personal-chat/domain"
import {
  parsePersonalChatPrivacyLinkBody,
  personalChatPrivacyRoomLabel,
} from "@/features/personal-chat/privacy-room-link"
import {
  REALTIME_SEND_ACK_TIMEOUT_MS,
  type JoinConversationInput,
  type LeaveConversationInput,
  type RealtimeAdapter,
  type RealtimeAdapterConnectionListener,
  type RealtimeAdapterEventMap,
  type SendRealtimeMessageInput,
} from "./realtime-adapter"

const realtimeTransportReactionSchema = z.object({
  emoji: z.string(),
  userId: z.string(),
  createdAt: z.string().datetime(),
})

const realtimeTransportMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
  reactions: z.array(realtimeTransportReactionSchema).optional().default([]),
  clientMessageId: z.string().optional(),
})

const realtimeMessageEnvelopeSchema = z.object({
  message: realtimeTransportMessageSchema,
})

const disconnectedState = (
  lastError: string | null = null,
): RealtimeConnectionState => ({
  status: "disconnected",
  lastError,
})

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const mapRealtimeTransportMessageToChatMessage = (
  rawMessage: z.infer<typeof realtimeTransportMessageSchema>,
): ChatMessage => {
  const privacyLink = parsePersonalChatPrivacyLinkBody(rawMessage.body)

  if (privacyLink) {
    return privacyLinkMessageSchema.parse({
      id: rawMessage.id,
      kind: "privacy-link",
      conversationId: rawMessage.conversationId,
      senderId: rawMessage.senderId,
      roomId: privacyLink.roomId,
      roomUrl: privacyLink.roomUrl,
      label: personalChatPrivacyRoomLabel,
      sentAt: rawMessage.createdAt,
      deliveryStatus: "sent",
      clientMessageId: rawMessage.clientMessageId,
    })
  }

  return textChatMessageSchema.parse({
    id: rawMessage.id,
    kind: "text",
    conversationId: rawMessage.conversationId,
    senderId: rawMessage.senderId,
    text: rawMessage.body,
    sentAt: rawMessage.createdAt,
    deliveryStatus: "sent",
    clientMessageId: rawMessage.clientMessageId,
  })
}

type SocketClient = ReturnType<typeof io>

type RealtimeEventListener<EventName extends keyof RealtimeAdapterEventMap> = (
  payload: RealtimeAdapterEventMap[EventName],
) => void

export class SocketIoRealtimeAdapter implements RealtimeAdapter {
  private socket: SocketClient | null = null
  private connectionState: RealtimeConnectionState = {
    status: "idle",
    lastError: null,
  }
  private eventListeners: {
    [EventName in keyof RealtimeAdapterEventMap]: Set<
      RealtimeEventListener<EventName>
    >
  } = {
    "message:new": new Set(),
    "message:error": new Set(),
  }
  private connectionListeners = new Set<RealtimeAdapterConnectionListener>()
  private readonly handleConnect = () => {
    this.setConnectionState({
      status: "connected",
      lastError: null,
    })
  }
  private readonly handleDisconnect = (reason?: string) => {
    this.setConnectionState(
      disconnectedState(
        reason && reason !== "io client disconnect"
          ? `Realtime disconnected (${reason})`
          : null,
      ),
    )
  }
  private readonly handleConnectError = (error: unknown) => {
    this.setConnectionState({
      status: "error",
      lastError: getErrorMessage(error, "Realtime connection failed"),
    })
  }
  private readonly handleReconnectAttempt = () => {
    this.setConnectionState({
      status: "reconnecting",
      lastError: null,
    })
  }
  private readonly handleReconnectFailed = () => {
    this.setConnectionState({
      status: "error",
      lastError: "Realtime reconnection failed",
    })
  }
  private readonly handleRawMessageNew = (payload: unknown) => {
    try {
      const parsedPayload = realtimeMessageEnvelopeSchema.parse(payload)
      const message = chatMessageSchema.parse(
        mapRealtimeTransportMessageToChatMessage(parsedPayload.message),
      )
      this.emit("message:new", messageNewEventSchema.parse({ message }))
    } catch (error) {
      this.setConnectionState({
        status: "error",
        lastError: getErrorMessage(error, "Invalid realtime message payload"),
      })
    }
  }
  private readonly handleRawMessageError = (payload: unknown) => {
    try {
      this.emit("message:error", messageErrorEventSchema.parse(payload))
    } catch (error) {
      this.setConnectionState({
        status: "error",
        lastError: getErrorMessage(error, "Invalid realtime error payload"),
      })
    }
  }

  async connect(session: RealtimeSessionBootstrap) {
    this.setConnectionState({
      status: "connecting",
      lastError: null,
    })

    let parsedSession: z.infer<typeof gatewayRealtimeSessionBootstrapSchema>
    try {
      parsedSession = gatewayRealtimeSessionBootstrapSchema.parse(session)
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Socket.IO adapter only supports gateway sessions",
      )
      this.setConnectionState(disconnectedState(message))
      throw new Error(message)
    }

    if (new Date(parsedSession.expiresAt).getTime() <= Date.now()) {
      const error = "Realtime session has expired"
      this.setConnectionState(disconnectedState(error))
      throw new Error(error)
    }

    this.disconnect()

    const socket = io(parsedSession.socketUrl, {
      autoConnect: false,
      auth: {
        token: parsedSession.accessToken,
      },
      transports: ["websocket"],
    })

    this.socket = socket
    this.registerSocketListeners(socket)

    try {
      await this.waitForConnect(socket)
    } catch (error) {
      this.cleanupSocket(socket)
      this.socket = null
      const message = getErrorMessage(error, "Realtime connection failed")
      this.setConnectionState({
        status: "error",
        lastError: message,
      })
      throw new Error(message)
    }
  }

  disconnect() {
    if (this.socket) {
      const socket = this.socket
      this.cleanupSocket(socket)
      socket.disconnect()
      this.socket = null
    }

    this.setConnectionState(disconnectedState())
  }

  getConnectionState() {
    return this.connectionState
  }

  async joinConversation(input: JoinConversationInput) {
    return this.emitConversationRoomAck("conversation:join", input)
  }

  async leaveConversation(input: LeaveConversationInput) {
    return this.emitConversationRoomAck("conversation:leave", input)
  }

  async sendMessage(input: SendRealtimeMessageInput) {
    const socket = this.socket

    if (!socket?.connected) {
      return messageSendAckSchema.parse({
        ok: false,
        error: "Realtime session is not connected",
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
      })
    }

    try {
      return await this.emitAck(
        socket,
        "message:send",
        input,
        messageSendAckSchema,
        REALTIME_SEND_ACK_TIMEOUT_MS,
      )
    } catch (error) {
      return messageSendAckSchema.parse({
        ok: false,
        error: getErrorMessage(error, "Realtime message send failed"),
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
      })
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

  private registerSocketListeners(socket: SocketClient) {
    socket.on("connect", this.handleConnect)
    socket.on("disconnect", this.handleDisconnect)
    socket.on("connect_error", this.handleConnectError)
    socket.on("message:new", this.handleRawMessageNew)
    socket.on("message:error", this.handleRawMessageError)
    socket.io.on("reconnect_attempt", this.handleReconnectAttempt)
    socket.io.on("reconnect_failed", this.handleReconnectFailed)
  }

  private cleanupSocket(socket: SocketClient) {
    socket.off("connect", this.handleConnect)
    socket.off("disconnect", this.handleDisconnect)
    socket.off("connect_error", this.handleConnectError)
    socket.off("message:new", this.handleRawMessageNew)
    socket.off("message:error", this.handleRawMessageError)
    socket.io.off("reconnect_attempt", this.handleReconnectAttempt)
    socket.io.off("reconnect_failed", this.handleReconnectFailed)
  }

  private waitForConnect(socket: SocketClient) {
    if (socket.connected) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      const handleConnected = () => {
        cleanup()
        resolve()
      }

      const handleError = (error: unknown) => {
        cleanup()
        reject(error)
      }

      const cleanup = () => {
        socket.off("connect", handleConnected)
        socket.off("connect_error", handleError)
      }

      socket.on("connect", handleConnected)
      socket.on("connect_error", handleError)
      socket.connect()
    })
  }

  private async emitConversationRoomAck(
    eventName: "conversation:join" | "conversation:leave",
    input: JoinConversationInput | LeaveConversationInput,
  ) {
    const socket = this.socket

    if (!socket?.connected) {
      return conversationRoomAckSchema.parse({
        ok: false,
        error: "Realtime session is not connected",
        conversationId: input.conversationId,
      })
    }

    try {
      return await this.emitAck(
        socket,
        eventName,
        input,
        conversationRoomAckSchema,
        REALTIME_SEND_ACK_TIMEOUT_MS,
      )
    } catch (error) {
      return conversationRoomAckSchema.parse({
        ok: false,
        error: getErrorMessage(error, `Realtime ${eventName} failed`),
        conversationId: input.conversationId,
      })
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

  private emitAck<TSchema extends z.ZodTypeAny>(
    socket: SocketClient,
    eventName: string,
    payload: unknown,
    schema: TSchema,
    timeoutMs: number,
  ): Promise<z.infer<TSchema>> {
    return new Promise((resolve, reject) => {
      let settled = false
      const timeoutHandle = setTimeout(() => {
        if (settled) {
          return
        }

        settled = true
        reject(new Error(`Realtime ${eventName} timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      try {
        socket.emit(eventName, payload, (response: unknown) => {
          if (settled) {
            return
          }

          settled = true
          clearTimeout(timeoutHandle)

          try {
            resolve(schema.parse(response))
          } catch (error) {
            reject(error)
          }
        })
      } catch (error) {
        clearTimeout(timeoutHandle)
        reject(error)
      }
    })
  }

  private setConnectionState(state: RealtimeConnectionState) {
    this.connectionState = realtimeConnectionStateSchema.parse(state)

    for (const listener of this.connectionListeners) {
      listener(this.connectionState)
    }
  }
}

export const createSocketIoRealtimeAdapter = () => new SocketIoRealtimeAdapter()
