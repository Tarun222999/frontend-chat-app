import type { PersonalChatService } from "./personal-chat-service"
import { createMockPersonalChatService } from "@/features/personal-chat/mocks/mock-personal-chat-service"

export const getPersonalChatService = (): PersonalChatService =>
  createMockPersonalChatService()
