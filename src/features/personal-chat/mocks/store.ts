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
import { buildPersonalChatPrivacyRoomUrl } from "@/features/personal-chat/privacy-room-link"
import {
  mockConversationDetails,
  mockDmCandidates,
  mockPersonalSession,
} from "./fixtures"

const MOCK_PERSONAL_LOGIN = {
  email: "echo@stitch.local",
  password: "Password123!",
}

const MOCK_PERSONAL_SESSION_TOKEN = "mock-session-user-echo"

interface MockRegisteredAccount {
  email: string
  password: string
  user: SessionUser
  sessionToken: string
}

interface MockPersonalChatState {
  dmCandidates: DmCandidate[]
  conversationDetails: Record<string, ConversationDetail>
}

const clone = <T>(value: T): T => structuredClone(value)

const initialState = (): MockPersonalChatState => ({
  dmCandidates: clone(mockDmCandidates),
  conversationDetails: clone(mockConversationDetails),
})

const state = initialState()
const registeredAccounts = new Map<string, MockRegisteredAccount>()
const activeSessionUsers = new Map<string, SessionUser>()

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const buildHandle = (email: string, displayName: string, fallbackId: string) => {
  const source = email.split("@")[0] ?? displayName
  const normalized = source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized.length > 0 ? normalized : `user-${fallbackId.slice(0, 6)}`
}

const buildSession = (user: SessionUser): PersonalSession => ({
  isAuthenticated: true,
  user: clone(user),
})

const seedMockAccount = () => {
  const user = clone(mockPersonalSession.user)

  if (!user) {
    return
  }

  const account: MockRegisteredAccount = {
    email: MOCK_PERSONAL_LOGIN.email,
    password: MOCK_PERSONAL_LOGIN.password,
    user,
    sessionToken: MOCK_PERSONAL_SESSION_TOKEN,
  }

  registeredAccounts.set(normalizeEmail(account.email), account)
  activeSessionUsers.set(account.sessionToken, clone(account.user))
}

seedMockAccount()

const getSessionUser = (sessionToken?: string | null) => {
  if (!sessionToken) {
    return null
  }

  const user = activeSessionUsers.get(sessionToken)
  return user ? clone(user) : null
}

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

const appendSearchCandidate = (
  results: DmCandidate[],
  seenCandidateIds: Set<string>,
  candidate: DmCandidate,
  normalizedQuery: string,
  currentUserId: string,
) => {
  if (candidate.id === currentUserId || seenCandidateIds.has(candidate.id)) {
    return
  }

  const searchValue = `${candidate.displayName} ${candidate.handle}`.toLowerCase()

  if (!searchValue.includes(normalizedQuery)) {
    return
  }

  seenCandidateIds.add(candidate.id)
  results.push(clone(candidate))
}

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
    const account = registeredAccounts.get(normalizeEmail(email))

    if (!account || account.password !== password) {
      return null
    }

    activeSessionUsers.set(account.sessionToken, clone(account.user))

    return {
      sessionToken: account.sessionToken,
      session: buildSession(account.user),
    }
  },

  register(input: { email: string; password: string; displayName: string }) {
    const normalizedEmail = normalizeEmail(input.email)

    if (registeredAccounts.has(normalizedEmail)) {
      return null
    }

    const userId = `user-${nanoid(10)}`
    const user: SessionUser = {
      id: userId,
      handle: buildHandle(input.email, input.displayName, userId),
      displayName: input.displayName,
      avatarUrl: null,
    }
    const sessionToken = `mock-session-${nanoid(16)}`
    const account: MockRegisteredAccount = {
      email: normalizedEmail,
      password: input.password,
      user,
      sessionToken,
    }

    registeredAccounts.set(normalizedEmail, account)
    activeSessionUsers.set(sessionToken, clone(user))

    return {
      sessionToken,
      session: buildSession(user),
    }
  },

  logout() {},

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

  searchUsers(
    sessionToken: string | null | undefined,
    input: {
      query: string
      limit?: number
    },
  ) {
    const currentUser = requireSessionUser(sessionToken)
    const normalizedQuery = input.query.trim().toLowerCase()

    if (!normalizedQuery) {
      return []
    }

    const results: DmCandidate[] = []
    const seenCandidateIds = new Set<string>()

    for (const candidate of state.dmCandidates) {
      appendSearchCandidate(
        results,
        seenCandidateIds,
        candidate,
        normalizedQuery,
        currentUser.id,
      )
    }

    for (const conversation of Object.values(state.conversationDetails)) {
      appendSearchCandidate(
        results,
        seenCandidateIds,
        {
          id: conversation.participant.id,
          handle: conversation.participant.handle,
          displayName: conversation.participant.displayName,
          avatarUrl: conversation.participant.avatarUrl,
          isAvailable: true,
        },
        normalizedQuery,
        currentUser.id,
      )
    }

    for (const account of registeredAccounts.values()) {
      appendSearchCandidate(
        results,
        seenCandidateIds,
        {
          id: account.user.id,
          handle: account.user.handle,
          displayName: account.user.displayName,
          avatarUrl: account.user.avatarUrl,
          isAvailable: activeSessionUsers.has(account.sessionToken),
        },
        normalizedQuery,
        currentUser.id,
      )
    }

    return clone(results.slice(0, input.limit ?? 8))
  },

  getConversationSummaries(sessionToken?: string | null) {
    requireSessionUser(sessionToken)
    return clone(listConversationSummaries())
  },

  getConversationDetail(
    sessionToken: string | null | undefined,
    conversationId: string,
    input?: {
      limit?: number
      before?: string
      after?: string
    },
  ) {
    requireSessionUser(sessionToken)
    const conversation = state.conversationDetails[conversationId]

    if (!conversation) {
      return null
    }

    let messages = [...conversation.messages]

    if (input?.before) {
      const beforeIndex = messages.findIndex(({ id }) => id === input.before)
      messages = beforeIndex >= 0 ? messages.slice(0, beforeIndex) : []
    }

    if (input?.after) {
      messages = messages.filter(({ sentAt }) => sentAt > input.after!)
    }

    const hasMoreHistory =
      typeof input?.limit === "number" && !input.after
        ? messages.length > input.limit
        : conversation.hasMoreHistory

    if (typeof input?.limit === "number") {
      messages = messages.slice(-input.limit)
    }

    return clone({
      ...conversation,
      messages,
      hasMoreHistory,
    })
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
      encryptionKey: string
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
      roomUrl: buildPersonalChatPrivacyRoomUrl(
        input.roomId,
        input.encryptionKey,
      ),
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
