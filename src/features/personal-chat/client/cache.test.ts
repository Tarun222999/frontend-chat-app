import { describe, expect, it } from "vitest"
import type {
  ConversationDetail,
  ConversationSummary,
  TextChatMessage,
} from "@/features/personal-chat/domain"
import {
  applyMessageToConversationDetail,
  buildConversationSummaryFromMessage,
  mergeConversationMessage,
  unauthenticatedPersonalSession,
  upsertConversationSummary,
} from "./cache"

const baseConversation: ConversationDetail = {
  id: "conversation-1",
  participant: {
    id: "user-2",
    handle: "delta",
    displayName: "Delta",
    avatarUrl: null,
  },
  messages: [],
  hasMoreHistory: false,
}

const textMessage = (
  overrides?: Partial<TextChatMessage>,
): TextChatMessage => ({
  id: "message-1",
  kind: "text",
  conversationId: "conversation-1",
  senderId: "user-1",
  sentAt: "2026-04-14T18:30:00.000Z",
  deliveryStatus: "sent",
  text: "Hello there",
  ...overrides,
})

describe("personal chat client cache helpers", () => {
  it("defines a stable unauthenticated session snapshot", () => {
    expect(unauthenticatedPersonalSession).toEqual({
      isAuthenticated: false,
      user: null,
    })
  })

  it("upserts conversation summaries and keeps the newest one first", () => {
    const conversations: ConversationSummary[] = [
      {
        id: "conversation-1",
        participant: baseConversation.participant,
        lastMessagePreview: "Older",
        lastMessageAt: "2026-04-13T10:00:00.000Z",
        unreadCount: 0,
      },
      {
        id: "conversation-2",
        participant: {
          id: "user-3",
          handle: "echo",
          displayName: "Echo",
          avatarUrl: null,
        },
        lastMessagePreview: "Newest",
        lastMessageAt: "2026-04-14T10:00:00.000Z",
        unreadCount: 1,
      },
    ]

    const nextConversations = upsertConversationSummary(conversations, {
      ...conversations[0],
      lastMessagePreview: "Latest for conversation 1",
      lastMessageAt: "2026-04-15T10:00:00.000Z",
    })

    expect(nextConversations.map(({ id }) => id)).toEqual([
      "conversation-1",
      "conversation-2",
    ])
    expect(nextConversations[0]?.lastMessagePreview).toBe(
      "Latest for conversation 1",
    )
  })

  it("reconciles messages by clientMessageId before appending a new one", () => {
    const pendingMessage = textMessage({
      id: "temp-message",
      clientMessageId: "client-1",
      deliveryStatus: "pending",
    })
    const sentMessage = textMessage({
      id: "message-1",
      clientMessageId: "client-1",
      deliveryStatus: "sent",
    })

    const nextMessages = mergeConversationMessage([pendingMessage], sentMessage)

    expect(nextMessages).toEqual([sentMessage])
  })

  it("applies a returned message to the cached conversation detail", () => {
    const conversation = {
      ...baseConversation,
      messages: [textMessage({ id: "message-0", sentAt: "2026-04-14T17:00:00.000Z" })],
    }

    const nextConversation = applyMessageToConversationDetail(
      conversation,
      textMessage({ id: "message-2" }),
    )

    expect(nextConversation.messages).toHaveLength(2)
    expect(nextConversation.messages.at(-1)?.id).toBe("message-2")
  })

  it("builds a conversation summary preview for privacy-link messages", () => {
    const summary = buildConversationSummaryFromMessage(baseConversation, {
      id: "message-privacy",
      kind: "privacy-link",
      conversationId: "conversation-1",
      senderId: "user-1",
      sentAt: "2026-04-14T18:40:00.000Z",
      deliveryStatus: "sent",
      roomId: "room-1",
      roomUrl: "/private/room/room-1",
      label: "Open secure room",
    })

    expect(summary.lastMessagePreview).toBe("Shared a secure room link")
    expect(summary.lastMessageAt).toBe("2026-04-14T18:40:00.000Z")
  })
})
