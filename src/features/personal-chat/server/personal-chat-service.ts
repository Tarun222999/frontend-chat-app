import type {
  ConversationDetail,
  ConversationSummary,
  DmCandidate,
  PersonalSession,
} from "@/features/personal-chat/domain"

export interface PersonalChatService {
  getSession(): Promise<PersonalSession>
  getDmCandidates(): Promise<DmCandidate[]>
  getConversationSummaries(): Promise<ConversationSummary[]>
  getConversationDetail(
    conversationId: string,
  ): Promise<ConversationDetail>
}

export class PersonalChatConversationNotFoundError extends Error {
  conversationId: string

  constructor(conversationId: string) {
    super(`Conversation "${conversationId}" was not found`)
    this.name = "PersonalChatConversationNotFoundError"
    this.conversationId = conversationId
  }
}
