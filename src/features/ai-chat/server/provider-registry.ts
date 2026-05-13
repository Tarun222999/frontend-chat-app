import "server-only"

import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"
import type { AiModelProfile, AiModelSelection } from "@/features/ai-chat/domain"
import {
  aiChatServerConfig,
  getAiProfileConfig,
  validateAiChatProviderConfig,
} from "./config"

export interface ResolvedAiLanguageModel {
  model: LanguageModel
  selection: AiModelSelection
}

const createProviderModel = (selection: AiModelSelection): LanguageModel => {
  if (selection.provider === "google") {
    const google = createGoogleGenerativeAI({
      apiKey: aiChatServerConfig.apiKeys.google,
    })

    return google(selection.modelId)
  }

  if (selection.provider === "groq") {
    const groq = createGroq({
      apiKey: aiChatServerConfig.apiKeys.groq,
    })

    return groq(selection.modelId)
  }

  const openrouter = createOpenRouter({
    apiKey: aiChatServerConfig.apiKeys.openrouter,
  })

  return openrouter(selection.modelId)
}

export const resolveAiLanguageModel = (
  profile: AiModelProfile = aiChatServerConfig.defaultProfile,
): ResolvedAiLanguageModel => {
  if (aiChatServerConfig.serviceMode !== "provider") {
    throw new Error("AI provider models are unavailable in mock mode.")
  }

  validateAiChatProviderConfig()

  const selection = getAiProfileConfig(profile)

  return {
    selection,
    model: createProviderModel(selection),
  }
}

export const getAiModelSelection = (
  profile: AiModelProfile = aiChatServerConfig.defaultProfile,
): AiModelSelection => getAiProfileConfig(profile)
