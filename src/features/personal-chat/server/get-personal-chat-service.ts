import type { PersonalChatService } from "./personal-chat-service"
import { personalChatServerConfig } from "./config"
import { createGatewayPersonalChatService } from "./gateway-personal-chat-service"
import { createMockPersonalChatService } from "@/features/personal-chat/mocks/mock-personal-chat-service"

const mockPersonalChatService = createMockPersonalChatService()
const gatewayPersonalChatService = createGatewayPersonalChatService()

export const getPersonalChatService = (): PersonalChatService =>
  personalChatServerConfig.serviceMode === "gateway"
    ? gatewayPersonalChatService
    : mockPersonalChatService
