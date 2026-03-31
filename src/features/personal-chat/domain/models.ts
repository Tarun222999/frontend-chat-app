export interface SessionUser {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
}

export interface PersonalSession {
  isAuthenticated: boolean
  user: SessionUser | null
}

export interface DmCandidate {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
  isAvailable: boolean
}

export interface ConversationSummary {
  id: string
  participant: SessionUser
  lastMessagePreview: string | null
  lastMessageAt: string | null
  unreadCount: number
}

interface BaseChatMessage {
  id: string
  conversationId: string
  senderId: string
  sentAt: string
  deliveryStatus: "sent" | "pending" | "failed"
  clientMessageId?: string
}

export interface TextChatMessage extends BaseChatMessage {
  kind: "text"
  text: string
}

export interface PrivacyLinkMessage extends BaseChatMessage {
  kind: "privacy-link"
  roomId: string
  roomUrl: string
  label: string
}

export type ChatMessage = TextChatMessage | PrivacyLinkMessage

export interface ConversationDetail {
  id: string
  participant: SessionUser
  messages: ChatMessage[]
  hasMoreHistory: boolean
}

export interface RealtimeConnectionState {
  status:
    | "idle"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "disconnected"
    | "error"
  lastError: string | null
}
