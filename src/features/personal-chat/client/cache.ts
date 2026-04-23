"use client"

import type { QueryClient } from "@tanstack/react-query"
import type {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  PersonalSession,
} from "@/features/personal-chat/domain"
import {
  compareConversationMessages,
  sortConversationMessages,
} from "@/features/personal-chat/domain/message-order"
import { personalChatQueryKeys } from "./query-keys"

export const unauthenticatedPersonalSession: PersonalSession = {
  isAuthenticated: false,
  user: null,
}

export const getConversationSummaryPreview = (message: ChatMessage) => {
  if (message.kind === "privacy-link") {
    return "Shared a secure room link"
  }

  return message.text
}

const compareConversationSummaries = (
  left: ConversationSummary,
  right: ConversationSummary,
) => {
  if (!left.lastMessageAt && !right.lastMessageAt) {
    return 0
  }

  if (!left.lastMessageAt) {
    return 1
  }

  if (!right.lastMessageAt) {
    return -1
  }

  return right.lastMessageAt.localeCompare(left.lastMessageAt)
}

export const upsertConversationSummary = (
  conversations: ConversationSummary[],
  conversation: ConversationSummary,
) =>
  [...conversations.filter(({ id }) => id !== conversation.id), conversation].sort(
    compareConversationSummaries,
  )

export const mergeConversationMessage = (
  messages: ChatMessage[],
  message: ChatMessage,
) => {
  const existingMessageIndex = messages.findIndex((existingMessage) => {
    if (existingMessage.id === message.id) {
      return true
    }

    if (!existingMessage.clientMessageId || !message.clientMessageId) {
      return false
    }

    return existingMessage.clientMessageId === message.clientMessageId
  })

  if (existingMessageIndex === -1) {
    return sortConversationMessages([...messages, message])
  }

  const nextMessages = [...messages]
  nextMessages[existingMessageIndex] = message
  return sortConversationMessages(nextMessages)
}

export { compareConversationMessages, sortConversationMessages }

export const applyMessageToConversationDetail = (
  conversation: ConversationDetail,
  message: ChatMessage,
): ConversationDetail => ({
  ...conversation,
  messages: mergeConversationMessage(conversation.messages, message),
})

export const buildConversationSummaryFromMessage = (
  conversation: ConversationDetail,
  message: ChatMessage,
  unreadCount: number = 0,
): ConversationSummary => ({
  id: conversation.id,
  participant: conversation.participant,
  lastMessagePreview: getConversationSummaryPreview(message),
  lastMessageAt: message.sentAt,
  unreadCount,
})

export const updateConversationSummaryWithMessage = (
  conversation: ConversationSummary,
  message: ChatMessage,
): ConversationSummary => ({
  ...conversation,
  lastMessagePreview: getConversationSummaryPreview(message),
  lastMessageAt: message.sentAt,
})

export const updateConversationMessageCaches = (
  queryClient: QueryClient,
  message: ChatMessage,
) => {
  const matchesActiveConversationDetailQuery = (queryKey: readonly unknown[]) =>
    queryKey[0] === "personal-chat" &&
    queryKey[1] === "conversations" &&
    queryKey[2] === message.conversationId &&
    queryKey[4] == null &&
    queryKey[5] == null

  const cachedConversation = queryClient
    .getQueriesData<ConversationDetail>({
      predicate: (query) =>
        matchesActiveConversationDetailQuery(query.queryKey as readonly unknown[]),
    })
    .map(([, conversation]) => conversation)
    .find((conversation) => conversation != null)

  const nextConversation = cachedConversation
    ? applyMessageToConversationDetail(cachedConversation, message)
    : null

  queryClient.setQueriesData<ConversationDetail>(
    {
      predicate: (query) =>
        matchesActiveConversationDetailQuery(query.queryKey as readonly unknown[]),
    },
    (conversation) =>
      conversation ? applyMessageToConversationDetail(conversation, message) : conversation,
  )

  queryClient.setQueryData<ConversationSummary[] | undefined>(
    personalChatQueryKeys.conversations(),
    (currentConversations) => {
      const conversations = currentConversations ?? []
      const existingConversation = conversations.find(
        ({ id }) => id === message.conversationId,
      )

      if (existingConversation) {
        return upsertConversationSummary(conversations, {
          ...updateConversationSummaryWithMessage(existingConversation, message),
        })
      }

      if (!nextConversation) {
        return conversations
      }

      return upsertConversationSummary(
        conversations,
        buildConversationSummaryFromMessage(nextConversation, message),
      )
    },
  )
}
