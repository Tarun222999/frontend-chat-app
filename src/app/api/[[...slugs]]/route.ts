import { Elysia } from "elysia"
import { personalChatApi } from "@/features/personal-chat/server/api"
import { privateChatApi } from "@/features/private-chat/server/api"
import { logger } from "@/lib/logger"

const app = new Elysia({ prefix: "/api" })
  .use(privateChatApi)
  .use(personalChatApi)

const createRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const handleApiRequest = async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? createRequestId()
  const startedAt = performance.now()
  const url = new URL(request.url)

  try {
    const response = await app.fetch(request)
    const durationMs = Math.round(performance.now() - startedAt)

    response.headers.set("x-request-id", requestId)

    logger.info("API request completed", {
      requestId,
      method: request.method,
      path: url.pathname,
      status: response.status,
      durationMs,
    })

    return response
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt)

    logger.error("API request failed", {
      requestId,
      method: request.method,
      path: url.pathname,
      durationMs,
      error,
    })

    throw error
  }
}

export const GET = handleApiRequest
export const POST = handleApiRequest
export const DELETE = handleApiRequest

export type App = typeof app
