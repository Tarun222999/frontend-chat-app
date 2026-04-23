"use client"

import type {
  ChatMessage,
  RealtimeConnectionState,
  RealtimeSessionBootstrap,
} from "@/features/personal-chat/domain"
import { PersonalChatApiError } from "./personal-chat-api"
import { createMockRealtimeAdapter } from "./mock-realtime-adapter"
import type { RealtimeAdapter } from "./realtime-adapter"
import { createSocketIoRealtimeAdapter } from "./socketio-realtime-adapter"

const sameDayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

const monthDayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

export interface RealtimeJoinState {
  status: "idle" | "joining" | "joined" | "error"
  lastError: string | null
}

export interface ActiveRealtimeBinding {
  adapter: RealtimeAdapter | null
  joinedConversationId: string | null
  release: () => void
}

export interface RealtimeIndicator {
  label: "Connecting" | "Connected" | "Reconnecting" | "Error"
  dotClassName: string
  className: string
}

export const fallbackConnectionState: RealtimeConnectionState = {
  status: "idle",
  lastError: null,
}

export const fallbackJoinState: RealtimeJoinState = {
  status: "idle",
  lastError: null,
}

export const joiningRealtimeState: RealtimeJoinState = {
  status: "joining",
  lastError: null,
}

export const emptyRealtimeBinding: ActiveRealtimeBinding = {
  adapter: null,
  joinedConversationId: null,
  release: () => {},
}

export const createClientMessageId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

export const formatMessageTimestamp = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Just now"
  }

  const now = new Date()
  const isSameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()

  return isSameDay
    ? sameDayTimeFormatter.format(date)
    : monthDayTimeFormatter.format(date)
}

export const getThreadErrorMessage = (error: unknown) => {
  if (error instanceof PersonalChatApiError) {
    if (error.status === 401) {
      return "Your session expired. Sign in again to continue this conversation."
    }

    if (error.status === 404) {
      return "This conversation could not be found."
    }

    return error.message || "We couldn't complete that conversation action."
  }

  return "We couldn't complete that conversation action."
}

export const isConversationNotFoundError = (error: unknown) =>
  error instanceof PersonalChatApiError && error.status === 404

export const isUnauthorizedError = (error: unknown) =>
  error instanceof PersonalChatApiError && error.status === 401

export const buildPendingTextMessage = (input: {
  conversationId: string
  senderId: string
  text: string
  clientMessageId: string
}): ChatMessage => ({
  id: `pending-${input.clientMessageId}`,
  kind: "text",
  conversationId: input.conversationId,
  senderId: input.senderId,
  sentAt: new Date().toISOString(),
  deliveryStatus: "pending",
  clientMessageId: input.clientMessageId,
  text: input.text,
})

export const buildPendingPrivacyLinkMessage = (input: {
  conversationId: string
  senderId: string
  clientMessageId: string
}): ChatMessage => {
  const placeholderRoomId = `pending-${input.clientMessageId}`

  return {
    id: `pending-${input.clientMessageId}`,
    kind: "privacy-link",
    conversationId: input.conversationId,
    senderId: input.senderId,
    sentAt: new Date().toISOString(),
    deliveryStatus: "pending",
    clientMessageId: input.clientMessageId,
    roomId: placeholderRoomId,
    roomUrl: `/private/room/${placeholderRoomId}`,
    label: "Preparing secure room...",
  }
}

export const createRealtimeAdapterForBootstrap = (
  bootstrap: RealtimeSessionBootstrap,
): RealtimeAdapter => {
  if (bootstrap.provider === "mock") {
    return createMockRealtimeAdapter()
  }

  return createSocketIoRealtimeAdapter()
}

export const getRealtimeIndicator = (
  connectionState: RealtimeConnectionState,
  joinState: RealtimeJoinState,
): RealtimeIndicator | null => {
  if (connectionState.status === "reconnecting") {
    return {
      label: "Reconnecting",
      dotClassName: "bg-amber-300",
      className: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    }
  }

  if (connectionState.status === "error" || joinState.status === "error") {
    return {
      label: "Error",
      dotClassName: "bg-red-300",
      className: "border-red-400/30 bg-red-500/10 text-red-100",
    }
  }

  if (
    connectionState.status === "connecting" ||
    joinState.status === "joining" ||
    connectionState.status === "disconnected"
  ) {
    return {
      label: "Connecting",
      dotClassName: "bg-cyan-300",
      className: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
    }
  }

  if (connectionState.status === "connected" && joinState.status === "joined") {
    return {
      label: "Connected",
      dotClassName: "bg-emerald-300",
      className: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
    }
  }

  return null
}

export const getRealtimeStatusError = (
  connectionState: RealtimeConnectionState,
  joinState: RealtimeJoinState,
) => connectionState.lastError ?? joinState.lastError

export const cleanupRealtimeBinding = async (binding: ActiveRealtimeBinding) => {
  if (binding.adapter && binding.joinedConversationId) {
    try {
      await binding.adapter.leaveConversation({
        conversationId: binding.joinedConversationId,
      })
    } catch {
      // Cleanup should remain best-effort during thread switches and unmounts.
    }
  }

  binding.release()
  binding.adapter?.disconnect()
}

export const isRealtimeSendReady = (
  binding: ActiveRealtimeBinding,
  conversationId: string,
  connectionState: RealtimeConnectionState,
  joinState: RealtimeJoinState,
) =>
  Boolean(
    binding.adapter &&
      binding.joinedConversationId === conversationId &&
      connectionState.status === "connected" &&
      joinState.status === "joined",
  )
