export type PersonalChatServiceMode = "mock" | "gateway"

const normalizeServiceMode = (
  value: string | undefined,
): PersonalChatServiceMode =>
  value === "gateway" ? "gateway" : "mock"

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsedValue = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback
}

const normalizeUrlEnv = (value: string | undefined, fallback: string) => {
  const trimmed = (value || fallback).trim().replace(/^['"]|['"]$/g, "")
  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  return withProtocol.replace(/\/+$/, "")
}

const hasRedisConfig =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)

const serviceMode = normalizeServiceMode(process.env.PERSONAL_CHAT_SERVICE_MODE)

export const validateGatewayConfig = () => {
  if (serviceMode === "gateway" && !hasRedisConfig) {
    throw new Error(
      "PERSONAL_CHAT_SERVICE_MODE=gateway requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    )
  }
}

export const personalChatServerConfig = {
  serviceMode,
  gatewayBaseUrl: normalizeUrlEnv(
    process.env.PERSONAL_CHAT_GATEWAY_URL,
    "http://localhost:4000",
  ),
  gatewaySocketUrl: normalizeUrlEnv(
    process.env.PERSONAL_CHAT_GATEWAY_SOCKET_URL,
    "http://localhost:4002",
  ),
  hasRedisConfig,
  gatewayFetchTimeoutMs: parsePositiveInteger(
    process.env.PERSONAL_CHAT_GATEWAY_FETCH_TIMEOUT_MS,
    5000,
  ),
  gatewaySessionTtlSeconds: parsePositiveInteger(
    process.env.PERSONAL_CHAT_SESSION_TTL_SECONDS,
    60 * 60 * 24 * 7,
  ),
  gatewayRealtimeBridgeTtlSeconds: parsePositiveInteger(
    process.env.PERSONAL_CHAT_REALTIME_BRIDGE_TTL_SECONDS,
    60 * 30,
  ),
}
