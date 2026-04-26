"use client"

import type { InfiniteData, QueryClient } from "@tanstack/react-query"
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
import type { ConversationHistoryPageParam } from "./conversation-history-pagination"
import { flattenConversationHistoryPages } from "./conversation-history-pagination"
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
  options?: {
    appendIfMissing?: boolean
  },
): ConversationDetail => ({
  ...conversation,
  messages:
    options?.appendIfMissing === false
      ? (() => {
          const existingMessageIndex = conversation.messages.findIndex(
            (existingMessage) =>
              existingMessage.id === message.id ||
              Boolean(
                existingMessage.clientMessageId &&
                  message.clientMessageId &&
                  existingMessage.clientMessageId === message.clientMessageId,
              ),
          )

          if (existingMessageIndex === -1) {
            return conversation.messages
          }

          const nextMessages = [...conversation.messages]
          nextMessages[existingMessageIndex] = message
          return sortConversationMessages(nextMessages)
        })()
      : mergeConversationMessage(conversation.messages, message),
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
  const conversationContainsMessage = (conversation: ConversationDetail) =>
    conversation.messages.some(
      (existingMessage) =>
        existingMessage.id === message.id ||
        Boolean(
          existingMessage.clientMessageId &&
            message.clientMessageId &&
            existingMessage.clientMessageId === message.clientMessageId,
        ),
    )

  const applyMessageToHistory = (
    history: InfiniteData<ConversationDetail, ConversationHistoryPageParam>,
  ) => {
    const historyContainsMessage = history.pages.some(conversationContainsMessage)

    return {
      ...history,
      pages: history.pages.map((page) => {
        const hasExistingMessage = conversationContainsMessage(page)

        if (hasExistingMessage) {
          return applyMessageToConversationDetail(page, message, {
            appendIfMissing: false,
          })
        }

        if (historyContainsMessage || page !== history.pages.at(-1)) {
          return page
        }

        return applyMessageToConversationDetail(page, message)
      }),
    }
  }

  const matchesConversationDetailQuery = (queryKey: readonly unknown[]) =>
    queryKey[0] === "personal-chat" &&
    queryKey[1] === "conversations" &&
    queryKey[2] === message.conversationId &&
    queryKey[3] !== "history"

  const matchesLatestConversationDetailQuery = (queryKey: readonly unknown[]) =>
    matchesConversationDetailQuery(queryKey) &&
    queryKey[4] == null &&
    queryKey[5] == null

  const matchesConversationHistoryQuery = (queryKey: readonly unknown[]) =>
    queryKey[0] === "personal-chat" &&
    queryKey[1] === "conversations" &&
    queryKey[2] === message.conversationId &&
    queryKey[3] === "history"

  const cachedConversation = queryClient
    .getQueriesData<ConversationDetail>({
      predicate: (query) =>
        matchesLatestConversationDetailQuery(query.queryKey as readonly unknown[]),
    })
    .map(([, conversation]) => conversation)
    .find((conversation) => conversation != null)

  const cachedHistory = queryClient
    .getQueriesData<InfiniteData<ConversationDetail, ConversationHistoryPageParam>>({
      predicate: (query) =>
        matchesConversationHistoryQuery(query.queryKey as readonly unknown[]),
    })
    .map(([, history]) => history)
    .find((history) => history != null)

  const nextHistory = cachedHistory
    ? applyMessageToHistory(cachedHistory)
    : null

  const nextConversation = cachedConversation
    ? applyMessageToConversationDetail(cachedConversation, message)
    : nextHistory
      ? flattenConversationHistoryPages(nextHistory.pages)
    : null

  for (const [queryKey, conversation] of queryClient.getQueriesData<ConversationDetail>({
    predicate: (query) =>
      matchesConversationDetailQuery(query.queryKey as readonly unknown[]),
  })) {
    if (!conversation) {
      continue
    }

    queryClient.setQueryData(
      queryKey,
      matchesLatestConversationDetailQuery(queryKey as readonly unknown[])
        ? applyMessageToConversationDetail(conversation, message)
        : applyMessageToConversationDetail(conversation, message, {
            appendIfMissing: false,
          }),
    )
  }

  for (const [queryKey, history] of queryClient.getQueriesData<
    InfiniteData<ConversationDetail, ConversationHistoryPageParam>
  >({
    predicate: (query) =>
      matchesConversationHistoryQuery(query.queryKey as readonly unknown[]),
  })) {
    if (!history) {
      continue
    }

    queryClient.setQueryData(queryKey, applyMessageToHistory(history))
  }

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
