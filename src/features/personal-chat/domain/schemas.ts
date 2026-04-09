import { z } from "zod"

export const sessionUserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})

export const personalSessionSchema = z.object({
  isAuthenticated: z.boolean(),
  user: sessionUserSchema.nullable(),
})

export const dmCandidateSchema = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  isAvailable: z.boolean(),
})

export const conversationSummarySchema = z.object({
  id: z.string(),
  participant: sessionUserSchema,
  lastMessagePreview: z.string().nullable(),
  lastMessageAt: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
})

const baseChatMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  sentAt: z.string(),
  deliveryStatus: z.enum(["sent", "pending", "failed"]),
  clientMessageId: z.string().optional(),
})

export const textChatMessageSchema = baseChatMessageSchema.extend({
  kind: z.literal("text"),
  text: z.string(),
})

export const privacyLinkMessageSchema = baseChatMessageSchema.extend({
  kind: z.literal("privacy-link"),
  roomId: z.string(),
  roomUrl: z.string(),
  label: z.string(),
})

export const chatMessageSchema = z.discriminatedUnion("kind", [
  textChatMessageSchema,
  privacyLinkMessageSchema,
])

export const conversationDetailSchema = z.object({
  id: z.string(),
  participant: sessionUserSchema,
  messages: z.array(chatMessageSchema),
  hasMoreHistory: z.boolean(),
})

export const realtimeConnectionStateSchema = z.object({
  status: z.enum([
    "idle",
    "connecting",
    "connected",
    "reconnecting",
    "disconnected",
    "error",
  ]),
  lastError: z.string().nullable(),
})

export const realtimeSessionBootstrapSchema = z.object({
  provider: z.enum(["mock", "gateway"]),
  sessionId: z.string(),
  conversationId: z.string(),
  channel: z.string(),
  issuedAt: z.string(),
  expiresAt: z.string(),
})

export const conversationRoomAckSchema = z.object({
  ok: z.boolean(),
  conversationId: z.string().optional(),
  error: z.string().optional(),
})

export const messageSendAckSchema = z.object({
  ok: z.boolean(),
  conversationId: z.string(),
  messageId: z.string().optional(),
  clientMessageId: z.string().optional(),
  error: z.string().optional(),
})

export const messageNewEventSchema = z.object({
  message: chatMessageSchema,
})

export const messageErrorEventSchema = z.object({
  error: z.string(),
  conversationId: z.string().optional(),
  clientMessageId: z.string().optional(),
})

export type SessionUserSchema = z.infer<typeof sessionUserSchema>
export type PersonalSessionSchema = z.infer<typeof personalSessionSchema>
export type DmCandidateSchema = z.infer<typeof dmCandidateSchema>
export type ConversationSummarySchema = z.infer<typeof conversationSummarySchema>
export type TextChatMessageSchema = z.infer<typeof textChatMessageSchema>
export type PrivacyLinkMessageSchema = z.infer<typeof privacyLinkMessageSchema>
export type ChatMessageSchema = z.infer<typeof chatMessageSchema>
export type ConversationDetailSchema = z.infer<typeof conversationDetailSchema>
export type RealtimeConnectionStateSchema = z.infer<
  typeof realtimeConnectionStateSchema
>
export type RealtimeSessionBootstrapSchema = z.infer<
  typeof realtimeSessionBootstrapSchema
>
export type ConversationRoomAckSchema = z.infer<typeof conversationRoomAckSchema>
export type MessageSendAckSchema = z.infer<typeof messageSendAckSchema>
export type MessageNewEventSchema = z.infer<typeof messageNewEventSchema>
export type MessageErrorEventSchema = z.infer<typeof messageErrorEventSchema>
