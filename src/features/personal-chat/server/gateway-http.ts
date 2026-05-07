import type { SessionUser } from "@/features/personal-chat/domain"
import { mapTransportUserEnvelopeToSessionUser } from "@/features/personal-chat/server/mappers"
import type {
  TransportErrorResponse,
  TransportUserEnvelopeResponse,
} from "@/features/personal-chat/transport"
import { logger } from "@/lib/logger"
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

const JSON_CONTENT_TYPE_PATTERN = /\bapplication\/json\b/i

const parseJsonResponse = async <T>(response: Response): Promise<T | null> => {
  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get("content-type")

  if (!contentType || !JSON_CONTENT_TYPE_PATTERN.test(contentType)) {
    return null
  }

  const rawBody = await response.text()

  if (!rawBody.trim()) {
    return null
  }

  try {
    return JSON.parse(rawBody) as T
  } catch {
    throw new GatewayHttpError(
      response.status,
      response.statusText || "Gateway response JSON parse failed",
      rawBody
        ? ({
            message: rawBody,
          } as TransportErrorResponse)
        : undefined,
    )
  }
}

export const createGatewayFetch = async <T>(input: {
  path: string
  method?: string
  accessToken?: string
  body?: unknown
}): Promise<T> => {
  const method = input.method ?? "GET"
  const startedAt = performance.now()
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => {
    controller.abort()
  }, personalChatServerConfig.gatewayFetchTimeoutMs)

  let response: Response

  try {
    response = await fetch(
      `${personalChatServerConfig.gatewayBaseUrl}${input.path}`,
      {
        method,
        headers: {
          accept: "application/json",
          ...(input.accessToken
            ? { Authorization: `Bearer ${input.accessToken}` }
            : undefined),
          ...(input.body ? { "content-type": "application/json" } : undefined),
        },
        body: input.body ? JSON.stringify(input.body) : undefined,
        cache: "no-store",
        signal: controller.signal,
      },
    )
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt)

    if (error instanceof DOMException && error.name === "AbortError") {
      logger.error("Gateway request timed out", {
        method,
        path: input.path,
        durationMs,
        timeoutMs: personalChatServerConfig.gatewayFetchTimeoutMs,
      })

      throw new GatewayHttpError(
        504,
        `Gateway request timed out after ${personalChatServerConfig.gatewayFetchTimeoutMs}ms`,
      )
    }

    logger.error("Gateway request failed", {
      method,
      path: input.path,
      durationMs,
      error,
    })

    throw new GatewayHttpError(
      502,
      error instanceof Error ? error.message : "Gateway request failed",
    )
  } finally {
    clearTimeout(timeoutHandle)
  }

  if (!response.ok) {
    const durationMs = Math.round(performance.now() - startedAt)
    const errorBody = await parseJsonResponse<TransportErrorResponse>(response)
    const logMethod = response.status >= 500 ? logger.error : logger.warn

    logMethod("Gateway request returned non-success status", {
      method,
      path: input.path,
      status: response.status,
      durationMs,
    })

    throw new GatewayHttpError(
      response.status,
      errorBody?.message ?? response.statusText ?? "Gateway request failed",
      errorBody ?? undefined,
    )
  }

  logger.info("Gateway request completed", {
    method,
    path: input.path,
    status: response.status,
    durationMs: Math.round(performance.now() - startedAt),
  })

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
  let claims: GatewayAccessTokenClaims

  try {
    claims = JSON.parse(decodedPayload) as GatewayAccessTokenClaims
  } catch {
    throw new Error("Invalid access token payload")
  }

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
