"use client"

import type { ChatMessage, ConversationDetail } from "@/features/personal-chat/domain"
import { sortConversationMessages } from "@/features/personal-chat/domain/message-order"

export const DEFAULT_CONVERSATION_HISTORY_PAGE_SIZE = 40

export interface ConversationHistoryPageParam {
  limit: number
  before?: string
}

const mergeConversationHistoryMessage = (
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

export const buildInitialConversationHistoryPageParam = (
  limit: number = DEFAULT_CONVERSATION_HISTORY_PAGE_SIZE,
): ConversationHistoryPageParam => ({
  limit,
})

export const getPreviousConversationHistoryPageParam = (
  firstPage: ConversationDetail,
  limit: number = DEFAULT_CONVERSATION_HISTORY_PAGE_SIZE,
): ConversationHistoryPageParam | undefined => {
  const oldestMessage = firstPage.messages[0]

  if (!firstPage.hasMoreHistory || !oldestMessage) {
    return undefined
  }

  return {
    limit,
    before: oldestMessage.id,
  }
}

export const flattenConversationHistoryPages = (
  pages: ConversationDetail[],
): ConversationDetail | null => {
  const firstPage = pages[0]
  const latestPage = pages[pages.length - 1]

  if (!firstPage || !latestPage) {
    return null
  }

  return {
    id: latestPage.id,
    participant: latestPage.participant,
    messages: pages.reduce<ChatMessage[]>(
      (messages, page) =>
        page.messages.reduce(
          (currentMessages, message) =>
            mergeConversationHistoryMessage(currentMessages, message),
          messages,
        ),
      [],
    ),
    hasMoreHistory: firstPage.hasMoreHistory,
  }
}
