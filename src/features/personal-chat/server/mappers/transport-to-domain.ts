import {
  type ChatMessage,
  type ConversationDetail,
  type ConversationSummary,
  conversationDetailSchema,
  conversationSummarySchema,
  type DmCandidate,
  dmCandidateSchema,
  personalSessionSchema,
  type PersonalSession,
  privacyLinkMessageSchema,
  type SessionUser,
  sessionUserSchema,
  textChatMessageSchema,
} from "@/features/personal-chat/domain"
import { sortConversationMessages } from "@/features/personal-chat/domain/message-order"
import type {
  TransportAuthResponse,
  TransportAuthUser,
  TransportConversation,
  TransportConversationEnvelope,
  TransportConversationListEnvelope,
  TransportConversationParticipant,
  TransportMessage,
  TransportMessageListEnvelope,
  TransportMessageEnvelope,
  TransportUser,
  TransportUserEnvelopeResponse,
  TransportUserListResponse,
  TransportUserSummary,
  TransportUserSummaryListResponse,
} from "@/features/personal-chat/transport"
import { parsePersonalChatPrivacyLinkBody } from "../privacy-link-message"

const normalizeHandle = (value: string, fallbackId: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (normalized.length > 0) {
    return normalized
  }

  return fallbackId.toLowerCase().slice(0, 12)
}

const buildConversationLabel = (
  conversation: TransportConversation,
  participants: TransportConversationParticipant[],
): string => {
  if (conversation.title) {
    return conversation.title
  }

  if (participants.length > 0) {
    return participants.map((participant) => participant.displayName).join(", ")
  }

  return `Conversation ${conversation.id.slice(0, 8)}`
}

const mapParticipantToSessionUser = (
  participant: TransportConversationParticipant,
): SessionUser =>
  sessionUserSchema.parse({
    id: participant.id,
    handle: normalizeHandle(participant.displayName, participant.id),
    displayName: participant.displayName,
    avatarUrl: null,
  })

const mapFallbackConversationUser = (
  conversation: TransportConversation,
  participants: TransportConversationParticipant[],
): SessionUser => {
  const label = buildConversationLabel(conversation, participants)

  return sessionUserSchema.parse({
    id: conversation.id,
    handle: normalizeHandle(label, conversation.id),
    displayName: label,
    avatarUrl: null,
  })
}

const resolveConversationCounterparty = (
  conversation: TransportConversation,
  currentUserId?: string,
): SessionUser => {
  const participants = conversation.participants ?? []

  if (conversation.kind === "direct") {
    const otherParticipant =
      participants.find(
        (participant: TransportConversationParticipant) =>
          participant.id !== currentUserId,
      ) ??
      participants[0]

    if (otherParticipant) {
      return mapParticipantToSessionUser(otherParticipant)
    }
  }

  return mapFallbackConversationUser(conversation, participants)
}

export const mapTransportAuthUserToSessionUser = (
  user: TransportAuthUser,
): SessionUser =>
  sessionUserSchema.parse({
    id: user.id,
    handle: normalizeHandle(user.email.split("@")[0] ?? user.displayName, user.id),
    displayName: user.displayName,
    avatarUrl: null,
  })

export const mapTransportUserToSessionUser = (user: TransportUser): SessionUser =>
  sessionUserSchema.parse({
    id: user.id,
    handle: normalizeHandle(user.email.split("@")[0] ?? user.displayName, user.id),
    displayName: user.displayName,
    avatarUrl: null,
  })

export const mapTransportUserEnvelopeToSessionUser = (
  response: TransportUserEnvelopeResponse,
): SessionUser => mapTransportUserToSessionUser(response.data)

export const mapTransportAuthResponseToPersonalSession = (
  response: TransportAuthResponse,
): PersonalSession =>
  personalSessionSchema.parse({
    isAuthenticated: true,
    user: mapTransportAuthUserToSessionUser(response.user),
  })

export const mapTransportUserSummaryToDmCandidate = (
  user: TransportUserSummary,
): DmCandidate =>
  dmCandidateSchema.parse({
    id: user.id,
    handle: normalizeHandle(user.displayName, user.id),
    displayName: user.displayName,
    avatarUrl: null,
    isAvailable: true,
  })

export const mapTransportUserToDmCandidate = (user: TransportUser): DmCandidate =>
  dmCandidateSchema.parse({
    id: user.id,
    handle: normalizeHandle(user.email.split("@")[0] ?? user.displayName, user.id),
    displayName: user.displayName,
    avatarUrl: null,
    isAvailable: true,
  })

export const mapTransportUserSummaryListToDmCandidates = (
  response: TransportUserSummaryListResponse,
): DmCandidate[] => response.data.map(mapTransportUserSummaryToDmCandidate)

export const mapTransportUserListToDmCandidates = (
  response: TransportUserListResponse,
): DmCandidate[] => response.data.map(mapTransportUserToDmCandidate)

export const mapTransportConversationToSummary = (
  conversation: TransportConversation,
  currentUserId?: string,
): ConversationSummary =>
  conversationSummarySchema.parse({
    id: conversation.id,
    participant: resolveConversationCounterparty(conversation, currentUserId),
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: 0,
  })

export const mapTransportConversationListToSummaries = (
  response: TransportConversationListEnvelope,
  currentUserId?: string,
): ConversationSummary[] =>
  response.data.map((conversation: TransportConversation) =>
    mapTransportConversationToSummary(conversation, currentUserId),
  )

export const mapTransportMessageToChatMessage = (
  message: TransportMessage,
): ChatMessage => {
  const privacyLink = parsePersonalChatPrivacyLinkBody(message.body)

  if (privacyLink) {
    return privacyLinkMessageSchema.parse({
      id: message.id,
      kind: "privacy-link",
      conversationId: message.conversationId,
      senderId: message.senderId,
      roomId: privacyLink.roomId,
      roomUrl: privacyLink.roomUrl,
      label: privacyLink.label,
      sentAt: message.createdAt,
      deliveryStatus: "sent",
    })
  }

  return textChatMessageSchema.parse({
    id: message.id,
    kind: "text",
    conversationId: message.conversationId,
    senderId: message.senderId,
    text: message.body,
    sentAt: message.createdAt,
    deliveryStatus: "sent",
  })
}

export const mapTransportMessageEnvelopeToChatMessage = (
  response: TransportMessageEnvelope,
): ChatMessage => mapTransportMessageToChatMessage(response.data)

export const mapTransportMessageListToChatMessages = (
  response: TransportMessageListEnvelope,
): ChatMessage[] => response.data.map(mapTransportMessageToChatMessage)

export const mapTransportConversationToDetail = (
  conversation: TransportConversation,
  messages: TransportMessage[],
  options?: {
    currentUserId?: string
    hasMoreHistory?: boolean
  },
): ConversationDetail =>
  conversationDetailSchema.parse({
    id: conversation.id,
    participant: resolveConversationCounterparty(
      conversation,
      options?.currentUserId,
    ),
    messages: sortConversationMessages(
      messages.map(mapTransportMessageToChatMessage),
    ),
    hasMoreHistory: options?.hasMoreHistory ?? false,
  })

export const mapTransportConversationEnvelopeToDetail = (
  conversationResponse: TransportConversationEnvelope,
  messageResponse: TransportMessageListEnvelope,
  options?: {
    currentUserId?: string
    hasMoreHistory?: boolean
  },
): ConversationDetail =>
  mapTransportConversationToDetail(
    conversationResponse.data,
    messageResponse.data,
    options,
  )
