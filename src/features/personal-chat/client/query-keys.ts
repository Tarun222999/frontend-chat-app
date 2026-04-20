export const personalChatQueryKeys = {
  all: () => ["personal-chat"] as const,
  session: () => [...personalChatQueryKeys.all(), "session"] as const,
  dmCandidates: () => [...personalChatQueryKeys.all(), "dm-candidates"] as const,
  userSearch: () => [...personalChatQueryKeys.all(), "user-search"] as const,
  searchUsers: (query: string, limit: number) =>
    [...personalChatQueryKeys.userSearch(), query, limit] as const,
  conversations: () => [...personalChatQueryKeys.all(), "conversations"] as const,
  conversationDetail: (conversationId: string) =>
    [...personalChatQueryKeys.conversations(), conversationId] as const,
}
