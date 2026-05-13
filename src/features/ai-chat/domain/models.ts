export type AiModelProfile = "free" | "fast" | "balanced"

export type AiMessageRole = "user" | "assistant" | "system"

export type AiMessageStatus =
  | "pending"
  | "streaming"
  | "complete"
  | "failed"
  | "cancelled"

export interface AiModelSelection {
  profile: AiModelProfile
  provider: string
  modelId: string
}

export interface AiConversationSummary {
  id: string
  title: string
  model: AiModelSelection
  lastMessagePreview: string | null
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AiChatMessage {
  id: string
  conversationId: string
  role: AiMessageRole
  content: string
  status: AiMessageStatus
  model: AiModelSelection | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  clientMessageId?: string
}

export interface AiConversationDetail {
  id: string
  title: string
  model: AiModelSelection
  messages: AiChatMessage[]
  hasMoreHistory: boolean
  createdAt: string
  updatedAt: string
}

export interface AiConversationMessagePageInput {
  limit?: number
  before?: string
  after?: string
}

export interface CreateAiConversationInput {
  modelProfile?: AiModelProfile
  initialMessage?: string
  clientMessageId?: string
}

export interface RenameAiConversationInput {
  conversationId: string
  title: string
}

export interface SendAiMessageInput {
  conversationId: string
  text: string
  modelProfile: AiModelProfile
  clientMessageId?: string
}

export interface RetryAiMessageInput {
  conversationId: string
  assistantMessageId: string
  modelProfile?: AiModelProfile
}
