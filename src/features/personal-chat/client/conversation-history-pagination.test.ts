import { describe, expect, it } from "vitest"
import type { ChatMessage, ConversationDetail } from "@/features/personal-chat/domain"
import {
  buildInitialConversationHistoryPageParam,
  flattenConversationHistoryPages,
  getPreviousConversationHistoryPageParam,
} from "./conversation-history-pagination"

const buildTextMessage = (
  overrides: Partial<Extract<ChatMessage, { kind: "text" }>>,
): Extract<ChatMessage, { kind: "text" }> => ({
  id: "message-1",
  kind: "text",
  conversationId: "conversation-1",
  senderId: "user-1",
  sentAt: "2026-04-23T10:00:00.000Z",
  deliveryStatus: "sent",
  text: "hello",
  ...overrides,
})

const buildConversationPage = (
  overrides: Partial<ConversationDetail>,
): ConversationDetail => ({
  id: "conversation-1",
  participant: {
    id: "user-2",
    handle: "@alex",
    displayName: "Alex",
    avatarUrl: null,
  },
  messages: [],
  hasMoreHistory: false,
  ...overrides,
})

describe("conversation history pagination helpers", () => {
  it("builds the initial page param with the requested limit", () => {
    expect(buildInitialConversationHistoryPageParam(25)).toEqual({
      limit: 25,
    })
  })

  it("returns a before cursor for older history when the first page has more history", () => {
    const page = buildConversationPage({
      hasMoreHistory: true,
      messages: [
        buildTextMessage({
          id: "message-3",
          sentAt: "2026-04-23T10:03:00.000Z",
        }),
        buildTextMessage({
          id: "message-4",
          sentAt: "2026-04-23T10:04:00.000Z",
        }),
      ],
    })

    expect(getPreviousConversationHistoryPageParam(page, 25)).toEqual({
      limit: 25,
      before: "message-3",
    })
  })

  it("stops requesting older pages when the first page is exhausted", () => {
    const page = buildConversationPage({
      hasMoreHistory: false,
      messages: [
        buildTextMessage({
          id: "message-3",
          sentAt: "2026-04-23T10:03:00.000Z",
        }),
      ],
    })

    expect(getPreviousConversationHistoryPageParam(page, 25)).toBeUndefined()
  })

  it("flattens paged history oldest-to-newest and de-duplicates overlap", () => {
    const olderPage = buildConversationPage({
      hasMoreHistory: false,
      messages: [
        buildTextMessage({
          id: "message-1",
          sentAt: "2026-04-23T10:01:00.000Z",
          text: "older",
        }),
        buildTextMessage({
          id: "message-2",
          sentAt: "2026-04-23T10:02:00.000Z",
          text: "still older",
        }),
      ],
    })
    const latestPage = buildConversationPage({
      hasMoreHistory: true,
      messages: [
        buildTextMessage({
          id: "message-2",
          sentAt: "2026-04-23T10:02:00.000Z",
          text: "still older",
        }),
        buildTextMessage({
          id: "message-4",
          sentAt: "2026-04-23T10:04:00.000Z",
          text: "newer",
        }),
        buildTextMessage({
          id: "message-3",
          sentAt: "2026-04-23T10:03:00.000Z",
          text: "middle",
        }),
      ],
    })

    expect(flattenConversationHistoryPages([olderPage, latestPage])).toEqual({
      ...latestPage,
      messages: [
        buildTextMessage({
          id: "message-1",
          sentAt: "2026-04-23T10:01:00.000Z",
          text: "older",
        }),
        buildTextMessage({
          id: "message-2",
          sentAt: "2026-04-23T10:02:00.000Z",
          text: "still older",
        }),
        buildTextMessage({
          id: "message-3",
          sentAt: "2026-04-23T10:03:00.000Z",
          text: "middle",
        }),
        buildTextMessage({
          id: "message-4",
          sentAt: "2026-04-23T10:04:00.000Z",
          text: "newer",
        }),
      ],
      hasMoreHistory: false,
    })
  })
})
