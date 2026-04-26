import type { ConversationDetailMessagePageInput } from "./personal-chat-api"

export const personalChatQueryKeys = {
  all: () => ["personal-chat"] as const,
  session: () => [...personalChatQueryKeys.all(), "session"] as const,
  dmCandidates: () => [...personalChatQueryKeys.all(), "dm-candidates"] as const,
  userSearch: () => [...personalChatQueryKeys.all(), "user-search"] as const,
  searchUsers: (query: string, limit: number) =>
    [...personalChatQueryKeys.userSearch(), query, limit] as const,
  conversations: () => [...personalChatQueryKeys.all(), "conversations"] as const,
  conversationHistory: (conversationId: string, limit: number) =>
    [
      ...personalChatQueryKeys.conversations(),
      conversationId,
      "history",
      limit,
    ] as const,
  conversationDetail: (
    conversationId: string,
    page?: ConversationDetailMessagePageInput,
  ) =>
    [
      ...personalChatQueryKeys.conversations(),
      conversationId,
      page?.limit ?? null,
      page?.before ?? null,
      page?.after ?? null,
    ] as const,
}
