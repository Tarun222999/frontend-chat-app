export const personalChatQueryKeys = {
  all: () => ["personal-chat"] as const,
  session: () => ["personal-chat", "session"] as const,
  dmCandidates: () => ["personal-chat", "dm-candidates"] as const,
  conversations: () => ["personal-chat", "conversations"] as const,
  conversationDetail: (conversationId: string) =>
    ["personal-chat", "conversations", conversationId] as const,
}
