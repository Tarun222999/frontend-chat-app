export type PersonalChatServiceMode = "mock" | "gateway"

const normalizeServiceMode = (
  value: string | undefined,
): PersonalChatServiceMode =>
  value === "gateway" ? "gateway" : "mock"

export const personalChatServerConfig = {
  serviceMode: normalizeServiceMode(process.env.PERSONAL_CHAT_SERVICE_MODE),
  gatewayBaseUrl:
    process.env.PERSONAL_CHAT_GATEWAY_URL ?? "http://localhost:4000",
}
