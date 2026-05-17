import "server-only"

import { generateText } from "ai"
import type { AiModelProfile } from "@/features/ai-chat/domain"
import {
  createFallbackAiConversationTitle,
  normalizeAiConversationTitle,
} from "@/features/ai-chat/domain"
import { aiChatServerConfig } from "./config"
import { resolveAiLanguageModel } from "./provider-registry"

const titleSystemPrompt =
  "You generate short conversation titles for an AI chat product. " +
  "Return only the title. No quotes. No markdown. No punctuation at the end."

export const generateAiConversationTitle = async ({
  abortSignal,
  message,
  modelProfile,
}: {
  abortSignal?: AbortSignal
  message: string
  modelProfile: AiModelProfile
}) => {
  const fallbackTitle = createFallbackAiConversationTitle(message)

  if (aiChatServerConfig.serviceMode !== "provider") {
    return fallbackTitle
  }

  try {
    const resolvedModel = resolveAiLanguageModel(modelProfile)
    const result = await generateText({
      model: resolvedModel.model,
      system: titleSystemPrompt,
      prompt: [
        "Create a specific 3-6 word title for this first user message:",
        message.slice(0, 1200),
      ].join("\n\n"),
      maxOutputTokens: 24,
      temperature: 0.2,
      maxRetries: 0,
      timeout: 4000,
      abortSignal,
    })
    const title = normalizeAiConversationTitle(result.text)

    return title.length > 0 ? title : fallbackTitle
  } catch {
    return fallbackTitle
  }
}
