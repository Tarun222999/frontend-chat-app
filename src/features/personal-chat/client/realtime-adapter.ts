"use client"

import type {
  ConversationRoomAck,
  MessageErrorEvent,
  MessageNewEvent,
  MessageSendAck,
  RealtimeConnectionState,
  RealtimeSessionBootstrap,
} from "@/features/personal-chat/domain"

export interface RealtimeAdapterConnectionListener {
  (state: RealtimeConnectionState): void
}

export interface RealtimeAdapterEventMap {
  "message:new": MessageNewEvent
  "message:error": MessageErrorEvent
}

export interface JoinConversationInput {
  conversationId: string
}

export interface LeaveConversationInput {
  conversationId: string
}

export interface SendRealtimeMessageInput {
  conversationId: string
  body: string
  clientMessageId?: string
}

export const REALTIME_SEND_ACK_TIMEOUT_MS = 10_000

export interface RealtimeAdapter {
  connect(session: RealtimeSessionBootstrap): Promise<void>
  disconnect(): void
  getConnectionState(): RealtimeConnectionState
  joinConversation(input: JoinConversationInput): Promise<ConversationRoomAck>
  leaveConversation(input: LeaveConversationInput): Promise<ConversationRoomAck>
  sendMessage(input: SendRealtimeMessageInput): Promise<MessageSendAck>
  on<EventName extends keyof RealtimeAdapterEventMap>(
    event: EventName,
    listener: (payload: RealtimeAdapterEventMap[EventName]) => void,
  ): () => void
  onConnectionStateChange(listener: RealtimeAdapterConnectionListener): () => void
}
