import {
  conversationDetailSchema,
  conversationSummarySchema,
  dmCandidateSchema,
  personalSessionSchema,
} from "@/features/personal-chat/domain"
import {
  mockConversationDetails,
  mockConversationSummaries,
  mockDmCandidates,
  mockPersonalSession,
} from "./fixtures"
import {
  PersonalChatConversationNotFoundError,
  type PersonalChatService,
} from "@/features/personal-chat/server/personal-chat-service"

const clone = <T>(value: T): T => structuredClone(value)

export const createMockPersonalChatService = (): PersonalChatService => ({
  async getSession() {
    return personalSessionSchema.parse(clone(mockPersonalSession))
  },

  async getDmCandidates() {
    return dmCandidateSchema.array().parse(clone(mockDmCandidates))
  },

  async getConversationSummaries() {
    return conversationSummarySchema.array().parse(
      clone(mockConversationSummaries),
    )
  },

  async getConversationDetail(conversationId) {
    const conversation = mockConversationDetails[conversationId]

    if (!conversation) {
      throw new PersonalChatConversationNotFoundError(conversationId)
    }

    return conversationDetailSchema.parse(clone(conversation))
  },
})
