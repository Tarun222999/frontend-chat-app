import "server-only"

import type {
  AiChatMessage,
  AiConversationDetail,
  AiConversationSummary,
  AiModelSelection,
} from "@/features/ai-chat/domain"
import {
  aiChatMessageSchema,
  aiConversationDetailSchema,
  aiConversationSummarySchema,
} from "@/features/ai-chat/domain"
import type {
  AiConversationRecord,
  AiMessageRecord,
} from "@/db/schema"

const toIsoString = (value: Date) => value.toISOString()

export const mapAiConversationRecordToModelSelection = (
  record: Pick<
    AiConversationRecord,
    "modelProfile" | "modelProvider" | "modelId"
  >,
): AiModelSelection => ({
  profile: record.modelProfile,
  provider: record.modelProvider,
  modelId: record.modelId,
})

export const mapAiMessageRecordToModelSelection = (
  record: Pick<AiMessageRecord, "modelProfile" | "modelProvider" | "modelId">,
): AiModelSelection | null => {
  if (!record.modelProfile || !record.modelProvider || !record.modelId) {
    return null
  }

  return {
    profile: record.modelProfile,
    provider: record.modelProvider,
    modelId: record.modelId,
  }
}

export const mapAiMessageRecordToChatMessage = (
  record: AiMessageRecord,
  options?: {
    clientMessageId?: string
  },
): AiChatMessage =>
  aiChatMessageSchema.parse({
    id: record.id,
    conversationId: record.conversationId,
    role: record.role,
    content: record.content,
    status: record.status,
    model: mapAiMessageRecordToModelSelection(record),
    errorMessage: record.errorMessage,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
    clientMessageId: options?.clientMessageId,
  })

export const mapAiConversationRecordToSummary = (
  record: AiConversationRecord,
  latestMessage?: AiMessageRecord,
): AiConversationSummary =>
  aiConversationSummarySchema.parse({
    id: record.id,
    title: record.title,
    model: mapAiConversationRecordToModelSelection(record),
    lastMessagePreview: latestMessage?.content ?? null,
    lastMessageAt: latestMessage ? toIsoString(latestMessage.createdAt) : null,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
  })

export const mapAiConversationRecordsToDetail = ({
  conversation,
  messages,
  hasMoreHistory,
}: {
  conversation: AiConversationRecord
  messages: AiMessageRecord[]
  hasMoreHistory: boolean
}): AiConversationDetail =>
  aiConversationDetailSchema.parse({
    id: conversation.id,
    title: conversation.title,
    model: mapAiConversationRecordToModelSelection(conversation),
    messages: messages.map((message) => mapAiMessageRecordToChatMessage(message)),
    hasMoreHistory,
    createdAt: toIsoString(conversation.createdAt),
    updatedAt: toIsoString(conversation.updatedAt),
  })
