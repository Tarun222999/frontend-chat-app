import type { SessionUser } from "@/features/personal-chat/domain"
import {
  mapTransportConversationEnvelopeToDetail,
  mapTransportConversationListToSummaries,
  mapTransportConversationToSummary,
  mapTransportMessageEnvelopeToChatMessage,
  mapTransportUserEnvelopeToSessionUser,
  mapTransportUserSummaryListToDmCandidates,
} from "@/features/personal-chat/server/mappers"
import { createPersonalChatPrivacyLinkBody } from "@/features/personal-chat/server/privacy-link-message"
import type {
  CreatePrivacyRoomLinkInput,
  CreateRealtimeSessionInput,
  OpenDirectConversationInput,
  PersonalChatLoginInput,
  PersonalChatLoginResult,
  PersonalChatService,
  PersonalChatServiceContext,
  SendPersonalMessageInput,
} from "@/features/personal-chat/server/personal-chat-service"
import {
  PersonalChatBadRequestError,
  PersonalChatConversationNotFoundError,
  PersonalChatUnauthorizedError,
} from "@/features/personal-chat/server/personal-chat-service"
import type {
  TransportAuthTokens,
  TransportConversationEnvelope,
  TransportConversationListEnvelope,
  TransportErrorResponse,
  TransportMessageEnvelope,
  TransportMessageListEnvelope,
  TransportUserEnvelopeResponse,
  TransportUserSummaryListResponse,
} from "@/features/personal-chat/transport"
import { createPrivateRoom } from "@/features/private-chat/server/create-private-room"
import { personalChatServerConfig } from "./config"
import { gatewayPersonalChatSessionStore } from "./gateway-session-store"

interface GatewayAccessTokenClaims {
  sub: string
  email?: string
}

class GatewayHttpError extends Error {
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

const parseAccessTokenClaims = (accessToken: string): GatewayAccessTokenClaims => {
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

const createGatewayFetch = async <T>(input: {
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

const fetchGatewayUser = async (
  accessToken: string,
  userId: string,
): Promise<SessionUser> => {
  const response = await createGatewayFetch<TransportUserEnvelopeResponse>({
    path: `/users/${encodeURIComponent(userId)}`,
    accessToken,
  })

  return mapTransportUserEnvelopeToSessionUser(response)
}

const refreshGatewaySession = async (sessionToken: string) => {
  const session = gatewayPersonalChatSessionStore.get(sessionToken)

  if (!session) {
    throw new PersonalChatUnauthorizedError()
  }

  try {
    const tokens = await createGatewayFetch<TransportAuthTokens>({
      path: "/auth/refresh",
      method: "POST",
      body: {
        refreshToken: session.refreshToken,
      },
    })

    const updated = gatewayPersonalChatSessionStore.update(sessionToken, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })

    if (!updated) {
      throw new PersonalChatUnauthorizedError()
    }

    return updated
  } catch (error) {
    gatewayPersonalChatSessionStore.delete(sessionToken)

    if (error instanceof GatewayHttpError && error.status === 401) {
      throw new PersonalChatUnauthorizedError()
    }

    throw error
  }
}

const withGatewaySession = async <T>(
  context: PersonalChatServiceContext,
  action: (session: ReturnType<typeof gatewayPersonalChatSessionStore.get> extends infer _T
    ? Exclude<_T, null>
    : never) => Promise<T>,
): Promise<T> => {
  const session = gatewayPersonalChatSessionStore.get(context.sessionToken)

  if (!session) {
    throw new PersonalChatUnauthorizedError()
  }

  try {
    return await action(session)
  } catch (error) {
    if (
      error instanceof GatewayHttpError &&
      error.status === 401 &&
      context.sessionToken
    ) {
      const refreshedSession = await refreshGatewaySession(context.sessionToken)
      return action(refreshedSession)
    }

    if (error instanceof GatewayHttpError && error.status === 404) {
      throw new PersonalChatConversationNotFoundError(
        error.body?.details?.conversationId as string | undefined ??
          "unknown-conversation",
      )
    }

    throw error
  }
}

const toBadRequestError = (error: GatewayHttpError) =>
  new PersonalChatBadRequestError(error.body?.message ?? error.message)

export const createGatewayPersonalChatService = (): PersonalChatService => ({
  async getSession(context) {
    const session = gatewayPersonalChatSessionStore.get(context.sessionToken)

    if (!session) {
      return {
        isAuthenticated: false,
        user: null,
      }
    }

    return {
      isAuthenticated: true,
      user: session.user,
    }
  },

  async getDmCandidates(context) {
    return withGatewaySession(context, async (session) => {
      const response = await createGatewayFetch<TransportUserSummaryListResponse>({
        path: "/users/dm-candidates",
        accessToken: session.accessToken,
      })

      return mapTransportUserSummaryListToDmCandidates(response)
    })
  },

  async getConversationSummaries(context) {
    return withGatewaySession(context, async (session) => {
      const response = await createGatewayFetch<TransportConversationListEnvelope>({
        path: "/conversations",
        accessToken: session.accessToken,
      })

      return mapTransportConversationListToSummaries(response, session.user.id)
    })
  },

  async getConversationDetail(context, conversationId) {
    return withGatewaySession(context, async (session) => {
      try {
        const [conversationResponse, messagesResponse] = await Promise.all([
          createGatewayFetch<TransportConversationEnvelope>({
            path: `/conversations/${encodeURIComponent(conversationId)}`,
            accessToken: session.accessToken,
          }),
          createGatewayFetch<TransportMessageListEnvelope>({
            path: `/conversations/${encodeURIComponent(conversationId)}/messages`,
            accessToken: session.accessToken,
          }),
        ])

        return mapTransportConversationEnvelopeToDetail(
          conversationResponse,
          messagesResponse,
          session.user.id,
        )
      } catch (error) {
        if (error instanceof GatewayHttpError && error.status === 404) {
          throw new PersonalChatConversationNotFoundError(conversationId)
        }

        throw error
      }
    })
  },

  async login(input: PersonalChatLoginInput): Promise<PersonalChatLoginResult> {
    const tokens = await createGatewayFetch<TransportAuthTokens>({
      path: "/auth/login",
      method: "POST",
      body: input,
    })

    const claims = parseAccessTokenClaims(tokens.accessToken)
    const user = await fetchGatewayUser(tokens.accessToken, claims.sub)
    const record = gatewayPersonalChatSessionStore.create({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    })

    return {
      sessionToken: record.sessionToken,
      session: {
        isAuthenticated: true,
        user: record.user,
      },
    }
  },

  async logout(context) {
    const session = gatewayPersonalChatSessionStore.get(context.sessionToken)

    if (!session) {
      return
    }

    try {
      await createGatewayFetch<void>({
        path: "/auth/revoke",
        method: "POST",
        body: {
          userId: session.user.id,
        },
      })
    } finally {
      gatewayPersonalChatSessionStore.delete(context.sessionToken)
    }
  },

  async openOrCreateDirectConversation(
    context,
    input: OpenDirectConversationInput,
  ) {
    return withGatewaySession(context, async (session) => {
      try {
        const response = await createGatewayFetch<TransportConversationEnvelope>({
          path: "/direct-conversations",
          method: "POST",
          accessToken: session.accessToken,
          body: {
            participantId: input.participantId,
          },
        })

        return mapTransportConversationToSummary(response.data, session.user.id)
      } catch (error) {
        if (error instanceof GatewayHttpError && error.status === 400) {
          throw toBadRequestError(error)
        }

        throw error
      }
    })
  },

  async sendMessage(context, input: SendPersonalMessageInput) {
    return withGatewaySession(context, async (session) => {
      try {
        const response = await createGatewayFetch<TransportMessageEnvelope>({
          path: `/conversations/${encodeURIComponent(input.conversationId)}/messages`,
          method: "POST",
          accessToken: session.accessToken,
          body: {
            body: input.text,
          },
        })

        const message = mapTransportMessageEnvelopeToChatMessage(response)

        if (message.kind === "text" && input.clientMessageId) {
          return {
            ...message,
            clientMessageId: input.clientMessageId,
          }
        }

        return message
      } catch (error) {
        if (error instanceof GatewayHttpError && error.status === 404) {
          throw new PersonalChatConversationNotFoundError(input.conversationId)
        }

        if (error instanceof GatewayHttpError && error.status === 400) {
          throw toBadRequestError(error)
        }

        throw error
      }
    })
  },

  async createPrivacyRoomLink(context, input: CreatePrivacyRoomLinkInput) {
    return withGatewaySession(context, async (session) => {
      const { roomId } = await createPrivateRoom()

      try {
        const response = await createGatewayFetch<TransportMessageEnvelope>({
          path: `/conversations/${encodeURIComponent(input.conversationId)}/messages`,
          method: "POST",
          accessToken: session.accessToken,
          body: {
            body: createPersonalChatPrivacyLinkBody(roomId),
          },
        })

        const message = mapTransportMessageEnvelopeToChatMessage(response)

        if (message.kind !== "privacy-link") {
          throw new Error("Gateway privacy link message did not map correctly")
        }

        return {
          ...message,
          clientMessageId: input.clientMessageId,
        }
      } catch (error) {
        if (error instanceof GatewayHttpError && error.status === 404) {
          throw new PersonalChatConversationNotFoundError(input.conversationId)
        }

        if (error instanceof GatewayHttpError && error.status === 400) {
          throw toBadRequestError(error)
        }

        throw error
      }
    })
  },

  async createRealtimeSession(context, input: CreateRealtimeSessionInput) {
    return withGatewaySession(context, async (session) => {
      try {
        await createGatewayFetch<TransportConversationEnvelope>({
          path: `/conversations/${encodeURIComponent(input.conversationId)}`,
          accessToken: session.accessToken,
        })

        return gatewayPersonalChatSessionStore.createRealtimeBridgeSession({
          accessToken: session.accessToken,
          conversationId: input.conversationId,
        })
      } catch (error) {
        if (error instanceof GatewayHttpError && error.status === 404) {
          throw new PersonalChatConversationNotFoundError(input.conversationId)
        }

        throw error
      }
    })
  },
})
