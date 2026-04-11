export const personalChatQueryKeys = {
  all: () => ["personal-chat"] as const,
  session: () => [...personalChatQueryKeys.all(), "session"] as const,
  dmCandidates: () => [...personalChatQueryKeys.all(), "dm-candidates"] as const,
  conversations: () => [...personalChatQueryKeys.all(), "conversations"] as const,
  conversationDetail: (conversationId: string) =>
    [...personalChatQueryKeys.conversations(), conversationId] as const,
}
