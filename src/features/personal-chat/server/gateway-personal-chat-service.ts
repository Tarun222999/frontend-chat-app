import {
  mapTransportConversationEnvelopeToDetail,
  mapTransportConversationListToSummaries,
  mapTransportConversationToSummary,
  mapTransportMessageEnvelopeToChatMessage,
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
  SendPersonalMessageInput,
} from "@/features/personal-chat/server/personal-chat-service"
import {
  mapGatewayBadRequestError,
  mapGatewayConversationNotFoundError,
  mapGatewayLoginError,
  isGatewayBadRequestError,
  isGatewayStatus,
} from "./gateway-error-mapping"
import {
  createGatewayFetch,
  fetchGatewayUser,
  parseAccessTokenClaims,
} from "./gateway-http"
import {
  withGatewaySession,
} from "./gateway-session"
import {
  gatewayPersonalChatSessionStore,
} from "./gateway-session-store"
import type {
  TransportAuthTokens,
  TransportConversationEnvelope,
  TransportConversationListEnvelope,
  TransportMessageEnvelope,
  TransportMessageListEnvelope,
  TransportUserSummaryListResponse,
} from "@/features/personal-chat/transport"
import { createPrivateRoom } from "@/features/private-chat/server/create-private-room"
export const createGatewayPersonalChatService = (): PersonalChatService => ({
  async getSession(context) {
    const session = await gatewayPersonalChatSessionStore.get(
      context.sessionToken,
    )

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
      try {
        const response = await createGatewayFetch<TransportUserSummaryListResponse>({
          path: "/users/dm-candidates",
          accessToken: session.accessToken,
        })

        return mapTransportUserSummaryListToDmCandidates(response)
      } catch (error) {
        if (isGatewayBadRequestError(error)) {
          throw mapGatewayBadRequestError(error)
        }

        throw error
      }
    })
  },

  async getConversationSummaries(context) {
    return withGatewaySession(context, async (session) => {
      try {
        const response = await createGatewayFetch<TransportConversationListEnvelope>({
          path: "/conversations",
          accessToken: session.accessToken,
        })

        return mapTransportConversationListToSummaries(response, session.user.id)
      } catch (error) {
        if (isGatewayBadRequestError(error)) {
          throw mapGatewayBadRequestError(error)
        }

        throw error
      }
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
        if (isGatewayStatus(error, 404)) {
          throw mapGatewayConversationNotFoundError(conversationId)
        }

        if (isGatewayBadRequestError(error)) {
          throw mapGatewayBadRequestError(error)
        }

        throw error
      }
    })
  },

  async login(input: PersonalChatLoginInput): Promise<PersonalChatLoginResult> {
    let tokens: TransportAuthTokens

    try {
      tokens = await createGatewayFetch<TransportAuthTokens>({
        path: "/auth/login",
        method: "POST",
        body: input,
      })
    } catch (error) {
      throw mapGatewayLoginError(error)
    }

    const claims = parseAccessTokenClaims(tokens.accessToken)
    const user = await fetchGatewayUser(tokens.accessToken, claims.sub)
    const record = await gatewayPersonalChatSessionStore.create({
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
    const session = await gatewayPersonalChatSessionStore.get(
      context.sessionToken,
    )

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
      await gatewayPersonalChatSessionStore.delete(context.sessionToken)
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
        if (isGatewayBadRequestError(error)) {
          throw mapGatewayBadRequestError(error)
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
        if (isGatewayStatus(error, 404)) {
          throw mapGatewayConversationNotFoundError(input.conversationId)
        }

        if (isGatewayBadRequestError(error)) {
          throw mapGatewayBadRequestError(error)
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
        if (isGatewayStatus(error, 404)) {
          throw mapGatewayConversationNotFoundError(input.conversationId)
        }

        if (isGatewayBadRequestError(error)) {
          throw mapGatewayBadRequestError(error)
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
        if (isGatewayStatus(error, 404)) {
          throw mapGatewayConversationNotFoundError(input.conversationId)
        }

        if (isGatewayBadRequestError(error)) {
          throw mapGatewayBadRequestError(error)
        }

        throw error
      }
    })
  },
})
