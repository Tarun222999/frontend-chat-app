import type { PersonalChatService } from "./personal-chat-service"
import { personalChatServerConfig } from "./config"
import { createGatewayPersonalChatService } from "./gateway-personal-chat-service"
import { createMockPersonalChatService } from "@/features/personal-chat/mocks/mock-personal-chat-service"

let memoizedMockPersonalChatService: PersonalChatService | undefined
let memoizedGatewayPersonalChatService: PersonalChatService | undefined

export const getPersonalChatService = (): PersonalChatService => {
  if (personalChatServerConfig.serviceMode === "gateway") {
    if (!memoizedGatewayPersonalChatService) {
      memoizedGatewayPersonalChatService = createGatewayPersonalChatService()
    }

    return memoizedGatewayPersonalChatService
  }

  if (!memoizedMockPersonalChatService) {
    memoizedMockPersonalChatService = createMockPersonalChatService()
  }

  return memoizedMockPersonalChatService
}
