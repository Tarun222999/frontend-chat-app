export type PersonalChatServiceMode = "mock" | "gateway"
export type PersonalChatSessionStoreMode = "memory" | "redis"

const normalizeServiceMode = (
  value: string | undefined,
): PersonalChatServiceMode =>
  value === "gateway" ? "gateway" : "mock"

const normalizeSessionStoreMode = (
  value: string | undefined,
): PersonalChatSessionStoreMode => (value === "redis" ? "redis" : "memory")

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsedValue = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback
}

const hasRedisConfig =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)

export const personalChatServerConfig = {
  serviceMode: normalizeServiceMode(process.env.PERSONAL_CHAT_SERVICE_MODE),
  sessionStoreMode: normalizeSessionStoreMode(
    process.env.PERSONAL_CHAT_SESSION_STORE_MODE,
  ),
  gatewayBaseUrl:
    process.env.PERSONAL_CHAT_GATEWAY_URL ?? "http://localhost:4000",
  hasRedisConfig,
  gatewaySessionTtlSeconds: parsePositiveInteger(
    process.env.PERSONAL_CHAT_SESSION_TTL_SECONDS,
    60 * 60 * 24 * 7,
  ),
  gatewayRealtimeBridgeTtlSeconds: parsePositiveInteger(
    process.env.PERSONAL_CHAT_REALTIME_BRIDGE_TTL_SECONDS,
    60 * 30,
  ),
}
