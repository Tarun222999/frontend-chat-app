import type { AiConversationMessagePageInput } from "@/features/ai-chat/domain"

export const aiChatQueryKeys = {
  all: () => ["ai-chat"] as const,
  conversations: () => [...aiChatQueryKeys.all(), "conversations"] as const,
  conversationDetail: (
    conversationId: string,
    page?: AiConversationMessagePageInput,
  ) =>
    [
      ...aiChatQueryKeys.conversations(),
      conversationId,
      page?.limit ?? null,
      page?.before ?? null,
      page?.after ?? null,
    ] as const,
}
