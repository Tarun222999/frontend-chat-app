import type { SessionUser } from "@/features/personal-chat/domain"
import { mapTransportUserEnvelopeToSessionUser } from "@/features/personal-chat/server/mappers"
import type {
  TransportErrorResponse,
  TransportUserEnvelopeResponse,
} from "@/features/personal-chat/transport"
import { personalChatServerConfig } from "./config"

interface GatewayAccessTokenClaims {
  sub: string
  email?: string
}

export class GatewayHttpError extends Error {
  status: number
  body?: TransportErrorResponse

  constructor(status: number, message: string, body?: TransportErrorResponse) {
    super(message)
    this.name = "GatewayHttpError"
    this.status = status
    this.body = body
  }
}

const parseJsonResponse = async <T>(response: Response): Promise<T | null> => {
  if (response.status === 204) {
    return null
  }

  return (await response.json()) as T
}

export const createGatewayFetch = async <T>(input: {
  path: string
  method?: string
  accessToken?: string
  body?: unknown
}): Promise<T> => {
  const response = await fetch(
    `${personalChatServerConfig.gatewayBaseUrl}${input.path}`,
    {
      method: input.method ?? "GET",
      headers: {
        accept: "application/json",
        ...(input.accessToken
          ? { Authorization: `Bearer ${input.accessToken}` }
          : undefined),
        ...(input.body ? { "content-type": "application/json" } : undefined),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const errorBody = await parseJsonResponse<TransportErrorResponse>(response)
    throw new GatewayHttpError(
      response.status,
      errorBody?.message ?? "Gateway request failed",
      errorBody ?? undefined,
    )
  }

  return (await parseJsonResponse<T>(response)) as T
}

export const parseAccessTokenClaims = (
  accessToken: string,
): GatewayAccessTokenClaims => {
  const payload = accessToken.split(".")[1]

  if (!payload) {
    throw new Error("Invalid access token")
  }

  const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/")
  const decodedPayload = Buffer.from(normalizedPayload, "base64").toString("utf8")
  const claims = JSON.parse(decodedPayload) as GatewayAccessTokenClaims

  if (!claims.sub) {
    throw new Error("Access token is missing subject claim")
  }

  return claims
}

export const fetchGatewayUser = async (
  accessToken: string,
  userId: string,
): Promise<SessionUser> => {
  const response = await createGatewayFetch<TransportUserEnvelopeResponse>({
    path: `/users/${encodeURIComponent(userId)}`,
    accessToken,
  })

  return mapTransportUserEnvelopeToSessionUser(response)
}
