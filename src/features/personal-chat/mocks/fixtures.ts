import type {
  ConversationDetail,
  ConversationSummary,
  DmCandidate,
  PersonalSession,
  SessionUser,
} from "@/features/personal-chat/domain"

const sessionUser: SessionUser = {
  id: "user-echo",
  handle: "echo",
  displayName: "Echo Mercer",
  avatarUrl: null,
}

const participants = {
  aria: {
    id: "user-aria",
    handle: "aria",
    displayName: "Aria Stone",
    avatarUrl: null,
  },
  miles: {
    id: "user-miles",
    handle: "miles",
    displayName: "Miles Vega",
    avatarUrl: null,
  },
  june: {
    id: "user-june",
    handle: "june",
    displayName: "June Holloway",
    avatarUrl: null,
  },
  theo: {
    id: "user-theo",
    handle: "theo",
    displayName: "Theo Lane",
    avatarUrl: null,
  },
} satisfies Record<string, SessionUser>

export const mockPersonalSession: PersonalSession = {
  isAuthenticated: true,
  user: sessionUser,
}

export const mockDmCandidates: DmCandidate[] = [
  {
    id: participants.aria.id,
    handle: participants.aria.handle,
    displayName: participants.aria.displayName,
    avatarUrl: participants.aria.avatarUrl,
    isAvailable: true,
  },
  {
    id: participants.miles.id,
    handle: participants.miles.handle,
    displayName: participants.miles.displayName,
    avatarUrl: participants.miles.avatarUrl,
    isAvailable: true,
  },
  {
    id: participants.june.id,
    handle: participants.june.handle,
    displayName: participants.june.displayName,
    avatarUrl: participants.june.avatarUrl,
    isAvailable: false,
  },
  {
    id: participants.theo.id,
    handle: participants.theo.handle,
    displayName: participants.theo.displayName,
    avatarUrl: participants.theo.avatarUrl,
    isAvailable: true,
  },
]

export const mockConversationSummaries: ConversationSummary[] = [
  {
    id: "convo-aria",
    participant: participants.aria,
    lastMessagePreview: "I can take first pass on the room handoff copy.",
    lastMessageAt: "2026-03-31T13:20:00.000Z",
    unreadCount: 2,
  },
  {
    id: "convo-miles",
    participant: participants.miles,
    lastMessagePreview: "Push the mock adapter first and I will review the API shape.",
    lastMessageAt: "2026-03-31T12:05:00.000Z",
    unreadCount: 0,
  },
  {
    id: "convo-june",
    participant: participants.june,
    lastMessagePreview: null,
    lastMessageAt: null,
    unreadCount: 0,
  },
]

export const mockConversationDetails: Record<string, ConversationDetail> = {
  "convo-aria": {
    id: "convo-aria",
    participant: participants.aria,
    hasMoreHistory: true,
    messages: [
      {
        id: "msg-aria-1",
        kind: "text",
        conversationId: "convo-aria",
        senderId: participants.aria.id,
        text: "Morning. Did the private-room move land cleanly?",
        sentAt: "2026-03-31T13:15:00.000Z",
        deliveryStatus: "sent",
      },
      {
        id: "msg-aria-2",
        kind: "text",
        conversationId: "convo-aria",
        senderId: sessionUser.id,
        text: "Yes. Slice one kept the route stable and split the API composition.",
        sentAt: "2026-03-31T13:17:00.000Z",
        deliveryStatus: "sent",
      },
      {
        id: "msg-aria-3",
        kind: "text",
        conversationId: "convo-aria",
        senderId: participants.aria.id,
        text: "I can take first pass on the room handoff copy.",
        sentAt: "2026-03-31T13:20:00.000Z",
        deliveryStatus: "sent",
      },
    ],
  },
  "convo-miles": {
    id: "convo-miles",
    participant: participants.miles,
    hasMoreHistory: false,
    messages: [
      {
        id: "msg-miles-1",
        kind: "text",
        conversationId: "convo-miles",
        senderId: sessionUser.id,
        text: "Next slice is the service contract and mock read adapter.",
        sentAt: "2026-03-31T11:58:00.000Z",
        deliveryStatus: "sent",
      },
      {
        id: "msg-miles-2",
        kind: "text",
        conversationId: "convo-miles",
        senderId: participants.miles.id,
        text: "Push the mock adapter first and I will review the API shape.",
        sentAt: "2026-03-31T12:05:00.000Z",
        deliveryStatus: "sent",
      },
    ],
  },
  "convo-june": {
    id: "convo-june",
    participant: participants.june,
    hasMoreHistory: false,
    messages: [],
  },
}
