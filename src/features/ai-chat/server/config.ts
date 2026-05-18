import "server-only"

import type { AiModelProfile, AiModelSelection } from "@/features/ai-chat/domain"

export type AiChatServiceMode = "mock" | "provider"

export type AiProviderName = "google" | "groq" | "openrouter"

export type AiProfileConfig = AiModelSelection & {
  provider: AiProviderName
}

type AiProfileEnvName = "FREE" | "FAST" | "BALANCED"

const aiModelProfiles = ["free", "fast", "balanced"] as const

const defaultProfileConfig = {
  free: {
    provider: "google",
    modelId: "gemini-2.5-flash-lite",
  },
  fast: {
    provider: "groq",
    modelId: "llama-3.1-8b-instant",
  },
  balanced: {
    provider: "google",
    modelId: "gemini-2.5-flash",
  },
} as const satisfies Record<
  AiModelProfile,
  Pick<AiProfileConfig, "provider" | "modelId">
>

const providerApiKeyEnvNames = {
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
} as const satisfies Record<AiProviderName, string>

const profileEnvNames = {
  free: "FREE",
  fast: "FAST",
  balanced: "BALANCED",
} as const satisfies Record<AiModelProfile, AiProfileEnvName>

const normalizeStringEnv = (value: string | undefined) => {
  const normalizedValue = value?.trim().replace(/^['"]|['"]$/g, "")
  return normalizedValue && normalizedValue.length > 0
    ? normalizedValue
    : undefined
}

const normalizeServiceMode = (value: string | undefined): AiChatServiceMode =>
  normalizeStringEnv(value) === "provider" ? "provider" : "mock"

const normalizeModelProfile = (
  value: string | undefined,
  fallback: AiModelProfile,
): AiModelProfile => {
  const normalizedValue = normalizeStringEnv(value)

  return aiModelProfiles.includes(normalizedValue as AiModelProfile)
    ? (normalizedValue as AiModelProfile)
    : fallback
}

const normalizeProvider = (
  value: string | undefined,
  fallback: AiProviderName,
): AiProviderName => {
  const normalizedValue = normalizeStringEnv(value)

  if (
    normalizedValue === "google" ||
    normalizedValue === "groq" ||
    normalizedValue === "openrouter"
  ) {
    return normalizedValue
  }

  return fallback
}

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsedValue = Number.parseInt(normalizeStringEnv(value) ?? "", 10)
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback
}

const readProfileConfig = (profile: AiModelProfile): AiProfileConfig => {
  const envProfileName = profileEnvNames[profile]
  const fallback = defaultProfileConfig[profile]
  const provider = normalizeProvider(
    process.env[`AI_CHAT_${envProfileName}_PROVIDER`],
    fallback.provider,
  )
  const modelId =
    normalizeStringEnv(process.env[`AI_CHAT_${envProfileName}_MODEL`]) ??
    fallback.modelId

  return {
    profile,
    provider,
    modelId,
  }
}

const serviceMode = normalizeServiceMode(process.env.AI_CHAT_SERVICE_MODE)

const profiles: Record<AiModelProfile, AiProfileConfig> = {
  free: readProfileConfig("free"),
  fast: readProfileConfig("fast"),
  balanced: readProfileConfig("balanced"),
}

export const aiChatServerConfig = {
  serviceMode,
  defaultProfile: normalizeModelProfile(
    process.env.AI_CHAT_DEFAULT_PROFILE,
    "free",
  ),
  maxInputChars: parsePositiveInteger(
    process.env.AI_CHAT_MAX_INPUT_CHARS,
    12000,
  ),
  maxHistoryMessages: parsePositiveInteger(
    process.env.AI_CHAT_MAX_HISTORY_MESSAGES,
    30,
  ),
  rateLimitPerMinute: parsePositiveInteger(
    process.env.AI_CHAT_RATE_LIMIT_PER_MINUTE,
    10,
  ),
  profiles,
  apiKeys: {
    google: normalizeStringEnv(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    groq: normalizeStringEnv(process.env.GROQ_API_KEY),
    openrouter: normalizeStringEnv(process.env.OPENROUTER_API_KEY),
  },
} as const

export const getAiProfileConfig = (
  profile: AiModelProfile = aiChatServerConfig.defaultProfile,
) => aiChatServerConfig.profiles[profile]

export const validateAiChatProviderConfig = () => {
  if (aiChatServerConfig.serviceMode !== "provider") {
    return
  }

  const configuredProviders = new Set(
    Object.values(aiChatServerConfig.profiles).map(({ provider }) => provider),
  )
  const missingProviderKeys = Array.from(configuredProviders).filter(
    (provider) => !aiChatServerConfig.apiKeys[provider],
  )

  if (missingProviderKeys.length > 0) {
    const missingEnvNames = missingProviderKeys.map(
      (provider) => providerApiKeyEnvNames[provider],
    )

    throw new Error(
      `AI_CHAT_SERVICE_MODE=provider requires ${missingEnvNames.join(", ")}.`,
    )
  }
}
