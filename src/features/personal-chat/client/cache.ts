"use client"

import type {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  PersonalSession,
} from "@/features/personal-chat/domain"

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
    return [...messages, message]
  }

  const nextMessages = [...messages]
  nextMessages[existingMessageIndex] = message
  return nextMessages
}

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
