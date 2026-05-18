import { z } from "zod"

export const aiModelProfileSchema = z.enum(["free", "fast", "balanced"])

export const aiMessageRoleSchema = z.enum(["user", "assistant", "system"])

export const aiMessageStatusSchema = z.enum([
  "pending",
  "streaming",
  "complete",
  "failed",
  "cancelled",
])

export const aiModelSelectionSchema = z.object({
  profile: aiModelProfileSchema,
  provider: z.string().min(1),
  modelId: z.string().min(1),
})

export const aiConversationSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  model: aiModelSelectionSchema,
  lastMessagePreview: z.string().nullable(),
  lastMessageAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const aiChatMessageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  role: aiMessageRoleSchema,
  content: z.string(),
  status: aiMessageStatusSchema,
  model: aiModelSelectionSchema.nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  clientMessageId: z.string().min(1).optional(),
})

export const aiConversationDetailSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  model: aiModelSelectionSchema,
  messages: z.array(aiChatMessageSchema),
  hasMoreHistory: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const aiConversationMessagePageInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.string().min(1).optional(),
  after: z.iso.datetime().optional(),
})

export const createAiConversationInputSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  modelProfile: aiModelProfileSchema.optional(),
  initialMessage: z.string().trim().min(1).max(12000).optional(),
  clientMessageId: z.string().min(1).optional(),
})

export const renameAiConversationInputSchema = z.object({
  conversationId: z.string().min(1),
  title: z.string().trim().min(1).max(80),
})

export const sendAiMessageInputSchema = z.object({
  conversationId: z.string().min(1),
  text: z.string().trim().min(1).max(12000),
  modelProfile: aiModelProfileSchema,
  clientMessageId: z.string().min(1).optional(),
})

export const retryAiMessageInputSchema = z.object({
  conversationId: z.string().min(1),
  assistantMessageId: z.string().min(1),
  modelProfile: aiModelProfileSchema.optional(),
})

export const aiConversationSummariesResponseSchema = z.object({
  conversations: z.array(aiConversationSummarySchema),
})

export const aiConversationDetailResponseSchema = z.object({
  conversation: aiConversationDetailSchema,
})

export const aiConversationResponseSchema = z.object({
  conversation: aiConversationSummarySchema,
})

export const aiDeleteConversationResponseSchema = z.object({
  success: z.literal(true),
})

export const aiApiErrorResponseSchema = z.object({
  error: z.string(),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
})

export type AiModelProfileSchema = z.infer<typeof aiModelProfileSchema>
export type AiMessageRoleSchema = z.infer<typeof aiMessageRoleSchema>
export type AiMessageStatusSchema = z.infer<typeof aiMessageStatusSchema>
export type AiModelSelectionSchema = z.infer<typeof aiModelSelectionSchema>
export type AiConversationSummarySchema = z.infer<
  typeof aiConversationSummarySchema
>
export type AiChatMessageSchema = z.infer<typeof aiChatMessageSchema>
export type AiConversationDetailSchema = z.infer<
  typeof aiConversationDetailSchema
>
export type AiConversationMessagePageInputSchema = z.infer<
  typeof aiConversationMessagePageInputSchema
>
export type CreateAiConversationInputSchema = z.infer<
  typeof createAiConversationInputSchema
>
export type RenameAiConversationInputSchema = z.infer<
  typeof renameAiConversationInputSchema
>
export type SendAiMessageInputSchema = z.infer<
  typeof sendAiMessageInputSchema
>
export type RetryAiMessageInputSchema = z.infer<
  typeof retryAiMessageInputSchema
>
