import "server-only"

import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
} from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "@/db/client"
import {
  aiConversations,
  aiMessages,
  type AiConversationRecord,
  type AiMessageRecord,
} from "@/db/schema"
import type {
  AiChatMessage,
  AiConversationDetail,
  AiConversationMessagePageInput,
  AiConversationSummary,
  AiMessageRole,
  AiMessageStatus,
  AiModelProfile,
  AiModelSelection,
} from "@/features/ai-chat/domain"
import { getAiProfileConfig } from "./config"
import {
  mapAiConversationRecordToSummary,
  mapAiConversationRecordsToDetail,
  mapAiMessageRecordToChatMessage,
} from "./mappers"

const DEFAULT_CONVERSATION_TITLE = "New AI Chat"
const DEFAULT_MESSAGE_PAGE_SIZE = 50

const truncateTitle = (value: string) => {
  const normalizedValue = value.trim().replace(/\s+/g, " ")

  if (normalizedValue.length <= 80) {
    return normalizedValue
  }

  return `${normalizedValue.slice(0, 77).trimEnd()}...`
}

export class AiConversationNotFoundError extends Error {
  conversationId: string

  constructor(conversationId: string) {
    super(`AI conversation "${conversationId}" was not found`)
    this.name = "AiConversationNotFoundError"
    this.conversationId = conversationId
  }
}

export class AiMessageNotFoundError extends Error {
  messageId: string

  constructor(messageId: string) {
    super(`AI message "${messageId}" was not found`)
    this.name = "AiMessageNotFoundError"
    this.messageId = messageId
  }
}

export interface AiStorageContext {
  userId: string
}

export interface CreateAiConversationStorageInput {
  title?: string
  modelProfile?: AiModelProfile
  initialMessage?: string
  clientMessageId?: string
}

export interface InsertAiMessageStorageInput {
  conversationId: string
  role: AiMessageRole
  content: string
  status: AiMessageStatus
  model?: AiModelSelection | null
  errorMessage?: string | null
  clientMessageId?: string
}

export interface UpdateAiMessageStorageInput {
  messageId: string
  content?: string
  status?: AiMessageStatus
  errorMessage?: string | null
}

const getOwnedConversationRecord = async (
  context: AiStorageContext,
  conversationId: string,
): Promise<AiConversationRecord> => {
  const [conversation] = await db
    .select()
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, context.userId),
        isNull(aiConversations.deletedAt),
      ),
    )
    .limit(1)

  if (!conversation) {
    throw new AiConversationNotFoundError(conversationId)
  }

  return conversation
}

const getMessageRecord = async (
  context: AiStorageContext,
  messageId: string,
): Promise<AiMessageRecord> => {
  const [message] = await db
    .select()
    .from(aiMessages)
    .where(and(eq(aiMessages.id, messageId), eq(aiMessages.userId, context.userId)))
    .limit(1)

  if (!message) {
    throw new AiMessageNotFoundError(messageId)
  }

  return message
}

const getLatestMessagesByConversationId = async (
  conversationIds: string[],
): Promise<Map<string, AiMessageRecord>> => {
  if (conversationIds.length === 0) {
    return new Map()
  }

  const messages = await db
    .select()
    .from(aiMessages)
    .where(inArray(aiMessages.conversationId, conversationIds))
    .orderBy(desc(aiMessages.createdAt))

  const latestMessagesByConversationId = new Map<string, AiMessageRecord>()

  for (const message of messages) {
    if (!latestMessagesByConversationId.has(message.conversationId)) {
      latestMessagesByConversationId.set(message.conversationId, message)
    }
  }

  return latestMessagesByConversationId
}

const buildMessagePageFilter = async (
  context: AiStorageContext,
  conversationId: string,
  page?: AiConversationMessagePageInput,
) => {
  const filters = [
    eq(aiMessages.conversationId, conversationId),
    eq(aiMessages.userId, context.userId),
  ]

  if (page?.before) {
    const beforeMessage = await getMessageRecord(context, page.before)

    if (beforeMessage.conversationId !== conversationId) {
      throw new AiMessageNotFoundError(page.before)
    }

    filters.push(lt(aiMessages.createdAt, beforeMessage.createdAt))
  }

  if (page?.after) {
    filters.push(gt(aiMessages.createdAt, new Date(page.after)))
  }

  return and(...filters)
}

export const listAiConversationSummaries = async (
  context: AiStorageContext,
): Promise<AiConversationSummary[]> => {
  const conversations = await db
    .select()
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.userId, context.userId),
        isNull(aiConversations.deletedAt),
      ),
    )
    .orderBy(desc(aiConversations.updatedAt))

  const latestMessagesByConversationId = await getLatestMessagesByConversationId(
    conversations.map((conversation) => conversation.id),
  )

  return conversations.map((conversation) =>
    mapAiConversationRecordToSummary(
      conversation,
      latestMessagesByConversationId.get(conversation.id),
    ),
  )
}

export const createAiConversation = async (
  context: AiStorageContext,
  input: CreateAiConversationStorageInput = {},
): Promise<{
  conversation: AiConversationSummary
  initialMessage?: AiChatMessage
}> => {
  const now = new Date()
  const conversationId = nanoid()
  const model = getAiProfileConfig(input.modelProfile)
  const [conversation] = await db
    .insert(aiConversations)
    .values({
      id: conversationId,
      userId: context.userId,
      title: truncateTitle(input.title ?? input.initialMessage ?? DEFAULT_CONVERSATION_TITLE),
      modelProfile: model.profile,
      modelProvider: model.provider,
      modelId: model.modelId,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!conversation) {
    throw new Error("Failed to create AI conversation")
  }

  if (!input.initialMessage) {
    return {
      conversation: mapAiConversationRecordToSummary(conversation),
    }
  }

  const initialMessage = await insertAiMessage(context, {
    conversationId,
    role: "user",
    content: input.initialMessage,
    status: "complete",
    model: null,
    clientMessageId: input.clientMessageId,
  })

  return {
    conversation: mapAiConversationRecordToSummary(conversation, {
      id: initialMessage.id,
      conversationId: initialMessage.conversationId,
      userId: context.userId,
      role: initialMessage.role,
      content: initialMessage.content,
      status: initialMessage.status,
      modelProfile: initialMessage.model?.profile ?? null,
      modelProvider: initialMessage.model?.provider ?? null,
      modelId: initialMessage.model?.modelId ?? null,
      errorMessage: initialMessage.errorMessage,
      createdAt: new Date(initialMessage.createdAt),
      updatedAt: new Date(initialMessage.updatedAt),
    }),
    initialMessage,
  }
}

export const getAiConversationDetail = async (
  context: AiStorageContext,
  conversationId: string,
  page?: AiConversationMessagePageInput,
): Promise<AiConversationDetail> => {
  const conversation = await getOwnedConversationRecord(context, conversationId)
  const requestedLimit = page?.limit ?? DEFAULT_MESSAGE_PAGE_SIZE
  const messages = await db
    .select()
    .from(aiMessages)
    .where(await buildMessagePageFilter(context, conversationId, page))
    .orderBy(desc(aiMessages.createdAt))
    .limit(requestedLimit + 1)
  const hasMoreHistory = messages.length > requestedLimit
  const pageMessages = messages.slice(0, requestedLimit).reverse()

  return mapAiConversationRecordsToDetail({
    conversation,
    messages: pageMessages,
    hasMoreHistory,
  })
}

export const renameAiConversation = async (
  context: AiStorageContext,
  input: {
    conversationId: string
    title: string
  },
): Promise<AiConversationSummary> => {
  await getOwnedConversationRecord(context, input.conversationId)

  const [conversation] = await db
    .update(aiConversations)
    .set({
      title: truncateTitle(input.title),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiConversations.id, input.conversationId),
        eq(aiConversations.userId, context.userId),
        isNull(aiConversations.deletedAt),
      ),
    )
    .returning()

  if (!conversation) {
    throw new AiConversationNotFoundError(input.conversationId)
  }

  const latestMessagesByConversationId = await getLatestMessagesByConversationId([
    conversation.id,
  ])

  return mapAiConversationRecordToSummary(
    conversation,
    latestMessagesByConversationId.get(conversation.id),
  )
}

export const deleteAiConversation = async (
  context: AiStorageContext,
  conversationId: string,
) => {
  await getOwnedConversationRecord(context, conversationId)

  await db
    .update(aiConversations)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, context.userId),
        isNull(aiConversations.deletedAt),
      ),
    )
}

export const insertAiMessage = async (
  context: AiStorageContext,
  input: InsertAiMessageStorageInput,
): Promise<AiChatMessage> => {
  await getOwnedConversationRecord(context, input.conversationId)

  const now = new Date()
  const [message] = await db
    .insert(aiMessages)
    .values({
      id: nanoid(),
      conversationId: input.conversationId,
      userId: context.userId,
      role: input.role,
      content: input.content,
      status: input.status,
      modelProfile: input.model?.profile,
      modelProvider: input.model?.provider,
      modelId: input.model?.modelId,
      errorMessage: input.errorMessage,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!message) {
    throw new Error("Failed to create AI message")
  }

  await db
    .update(aiConversations)
    .set({
      updatedAt: now,
    })
    .where(eq(aiConversations.id, input.conversationId))

  return mapAiMessageRecordToChatMessage(message, {
    clientMessageId: input.clientMessageId,
  })
}

export const updateAiMessage = async (
  context: AiStorageContext,
  input: UpdateAiMessageStorageInput,
): Promise<AiChatMessage> => {
  await getMessageRecord(context, input.messageId)

  const now = new Date()
  const [message] = await db
    .update(aiMessages)
    .set({
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.errorMessage !== undefined
        ? { errorMessage: input.errorMessage }
        : {}),
      updatedAt: now,
    })
    .where(and(eq(aiMessages.id, input.messageId), eq(aiMessages.userId, context.userId)))
    .returning()

  if (!message) {
    throw new AiMessageNotFoundError(input.messageId)
  }

  await db
    .update(aiConversations)
    .set({
      updatedAt: now,
    })
    .where(eq(aiConversations.id, message.conversationId))

  return mapAiMessageRecordToChatMessage(message)
}

export const getRecentAiMessages = async (
  context: AiStorageContext,
  conversationId: string,
  limit: number,
): Promise<AiChatMessage[]> => {
  await getOwnedConversationRecord(context, conversationId)

  const messages = await db
    .select()
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.conversationId, conversationId),
        eq(aiMessages.userId, context.userId),
      ),
    )
    .orderBy(desc(aiMessages.createdAt))
    .limit(limit)

  return messages
    .reverse()
    .map((message) => mapAiMessageRecordToChatMessage(message))
}

export const getLastAiMessage = async (
  context: AiStorageContext,
  conversationId: string,
): Promise<AiChatMessage | null> => {
  await getOwnedConversationRecord(context, conversationId)

  const [message] = await db
    .select()
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.conversationId, conversationId),
        eq(aiMessages.userId, context.userId),
      ),
    )
    .orderBy(desc(aiMessages.createdAt))
    .limit(1)

  return message ? mapAiMessageRecordToChatMessage(message) : null
}
