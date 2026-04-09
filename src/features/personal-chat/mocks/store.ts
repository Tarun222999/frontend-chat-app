import { nanoid } from "nanoid"
import type {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  DmCandidate,
  PersonalSession,
  PrivacyLinkMessage,
  RealtimeSessionBootstrap,
  SessionUser,
} from "@/features/personal-chat/domain"
import {
  mockConversationDetails,
  mockDmCandidates,
  mockPersonalSession,
} from "./fixtures"

const MOCK_PERSONAL_LOGIN = {
  email: "echo@stitch.local",
  password: "Password123!",
}

interface MockPersonalChatState {
  activeSessions: Map<string, SessionUser>
  dmCandidates: DmCandidate[]
  conversationDetails: Record<string, ConversationDetail>
}

const clone = <T>(value: T): T => structuredClone(value)

const initialState = (): MockPersonalChatState => ({
  activeSessions: new Map<string, SessionUser>(),
  dmCandidates: clone(mockDmCandidates),
  conversationDetails: clone(mockConversationDetails),
})

const state = initialState()

const getSessionUser = (sessionToken?: string | null) =>
  sessionToken ? state.activeSessions.get(sessionToken) ?? null : null

const requireSessionUser = (sessionToken?: string | null) => {
  const user = getSessionUser(sessionToken)

  if (!user) {
    throw new Error("UNAUTHORIZED")
  }

  return user
}

const getConversationTimestamp = (conversation: ConversationDetail) => {
  const lastMessage = conversation.messages.at(-1)
  return lastMessage?.sentAt ?? null
}

const getConversationPreview = (message?: ChatMessage) => {
  if (!message) {
    return null
  }

  if (message.kind === "privacy-link") {
    return "Shared a secure room link"
  }

  return message.text
}

const buildConversationSummary = (
  conversation: ConversationDetail,
): ConversationSummary => {
  const lastMessage = conversation.messages.at(-1)

  return {
    id: conversation.id,
    participant: conversation.participant,
    lastMessagePreview: getConversationPreview(lastMessage),
    lastMessageAt: getConversationTimestamp(conversation),
    unreadCount: 0,
  }
}

const listConversationSummaries = () =>
  Object.values(state.conversationDetails)
    .map(buildConversationSummary)
    .sort((left, right) => {
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
    })

const findCandidateById = (participantId: string) =>
  state.dmCandidates.find((candidate) => candidate.id === participantId) ?? null

const findConversationByParticipantId = (participantId: string) =>
  Object.values(state.conversationDetails).find(
    (conversation) => conversation.participant.id === participantId,
  )

const appendConversationMessage = (
  conversationId: string,
  message: ChatMessage,
) => {
  const conversation = state.conversationDetails[conversationId]

  if (!conversation) {
    throw new Error(`Conversation "${conversationId}" was not found`)
  }

  conversation.messages.push(message)
  return message
}

export const mockPersonalChatStore = {
  login(email: string, password: string) {
    if (
      email !== MOCK_PERSONAL_LOGIN.email ||
      password !== MOCK_PERSONAL_LOGIN.password
    ) {
      return null
    }

    const user = clone(mockPersonalSession.user)

    if (!user) {
      return null
    }

    const sessionToken = `mock-session-${nanoid(16)}`
    state.activeSessions.set(sessionToken, user)

    return {
      sessionToken,
      session: {
        isAuthenticated: true,
        user,
      } satisfies PersonalSession,
    }
  },

  logout(sessionToken?: string | null) {
    if (sessionToken) {
      state.activeSessions.delete(sessionToken)
    }
  },

  getSession(sessionToken?: string | null): PersonalSession {
    const user = getSessionUser(sessionToken)

    return {
      isAuthenticated: !!user,
      user: user ? clone(user) : null,
    }
  },

  getDmCandidates(sessionToken?: string | null) {
    requireSessionUser(sessionToken)
    return clone(state.dmCandidates)
  },

  getConversationSummaries(sessionToken?: string | null) {
    requireSessionUser(sessionToken)
    return clone(listConversationSummaries())
  },

  getConversationDetail(sessionToken: string | null | undefined, conversationId: string) {
    requireSessionUser(sessionToken)
    return clone(state.conversationDetails[conversationId] ?? null)
  },

  openOrCreateDirectConversation(
    sessionToken: string | null | undefined,
    participantId: string,
  ) {
    requireSessionUser(sessionToken)

    const existingConversation = findConversationByParticipantId(participantId)

    if (existingConversation) {
      return clone(buildConversationSummary(existingConversation))
    }

    const candidate = findCandidateById(participantId)

    if (!candidate) {
      return null
    }

    const conversation: ConversationDetail = {
      id: `convo-${nanoid(10)}`,
      participant: {
        id: candidate.id,
        handle: candidate.handle,
        displayName: candidate.displayName,
        avatarUrl: candidate.avatarUrl,
      },
      messages: [],
      hasMoreHistory: false,
    }

    state.conversationDetails[conversation.id] = conversation

    return clone(buildConversationSummary(conversation))
  },

  sendMessage(
    sessionToken: string | null | undefined,
    input: {
      conversationId: string
      text: string
      clientMessageId?: string
    },
  ) {
    const user = requireSessionUser(sessionToken)
    const conversation = state.conversationDetails[input.conversationId]

    if (!conversation) {
      return null
    }

    const message: ChatMessage = {
      id: `msg-${nanoid(12)}`,
      kind: "text",
      conversationId: input.conversationId,
      senderId: user.id,
      text: input.text,
      sentAt: new Date().toISOString(),
      deliveryStatus: "sent",
      clientMessageId: input.clientMessageId,
    }

    appendConversationMessage(input.conversationId, message)
    return clone(message)
  },

  createPrivacyRoomLink(
    sessionToken: string | null | undefined,
    input: {
      conversationId: string
      roomId: string
      clientMessageId?: string
    },
  ): PrivacyLinkMessage | null {
    const user = requireSessionUser(sessionToken)
    const conversation = state.conversationDetails[input.conversationId]

    if (!conversation) {
      return null
    }

    const message: PrivacyLinkMessage = {
      id: `msg-${nanoid(12)}`,
      kind: "privacy-link",
      conversationId: input.conversationId,
      senderId: user.id,
      roomId: input.roomId,
      roomUrl: `/private/room/${input.roomId}`,
      label: "Open secure room",
      sentAt: new Date().toISOString(),
      deliveryStatus: "sent",
      clientMessageId: input.clientMessageId,
    }

    appendConversationMessage(input.conversationId, message)
    return clone(message)
  },

  createRealtimeSession(
    sessionToken: string | null | undefined,
    conversationId: string,
  ): RealtimeSessionBootstrap | null {
    requireSessionUser(sessionToken)

    if (!state.conversationDetails[conversationId]) {
      return null
    }

    const issuedAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    return {
      provider: "mock",
      sessionId: `rt-${nanoid(12)}`,
      conversationId,
      channel: `personal:${conversationId}`,
      issuedAt,
      expiresAt,
    }
  },
}
