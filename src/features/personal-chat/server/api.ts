import { Elysia } from "elysia"
import { z } from "zod"
import {
  chatMessageSchema,
  conversationDetailSchema,
  conversationSummarySchema,
  dmCandidateSchema,
  personalSessionSchema,
  privacyLinkMessageSchema,
  realtimeSessionBootstrapSchema,
} from "@/features/personal-chat/domain"
import { getPersonalChatService } from "./get-personal-chat-service"
import {
  PersonalChatBadRequestError,
  PersonalChatConversationNotFoundError,
  PersonalChatInvalidCredentialsError,
  PersonalChatParticipantNotFoundError,
  PersonalChatUnauthorizedError,
} from "./personal-chat-service"

const PERSONAL_CHAT_SESSION_COOKIE = "personal-chat-session"
const PERSONAL_CHAT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const directConversationBodySchema = z.object({
  participantId: z.string().min(1),
})

const sendMessageBodySchema = z.object({
  text: z.string().min(1).max(5000),
  clientMessageId: z.string().min(1).optional(),
})

const privacyRoomLinkBodySchema = z.object({
  clientMessageId: z.string().min(1).optional(),
})

const realtimeSessionBodySchema = z.object({
  conversationId: z.string().min(1),
})

const statusSchema = z.object({
  feature: z.literal("personal-chat"),
  status: z.literal("scaffolded"),
})

const conversationNotFoundSchema = z.object({
  error: z.literal("Conversation not found"),
  conversationId: z.string(),
})

const participantNotFoundSchema = z.object({
  error: z.literal("Participant not found"),
  participantId: z.string(),
})

const unauthorizedSchema = z.object({
  error: z.literal("Unauthorized"),
})

const invalidCredentialsSchema = z.object({
  error: z.literal("Invalid email or password"),
})

const badRequestSchema = z.object({
  error: z.string(),
})

const logoutResponseSchema = z.object({
  success: z.literal(true),
})

const sessionResponseSchema = z.object({
  session: personalSessionSchema,
})

const dmCandidatesResponseSchema = z.object({
  candidates: z.array(dmCandidateSchema),
})

const conversationListResponseSchema = z.object({
  conversations: z.array(conversationSummarySchema),
})

const conversationResponseSchema = z.object({
  conversation: conversationDetailSchema,
})

const directConversationResponseSchema = z.object({
  conversation: conversationSummarySchema,
})

const messageResponseSchema = z.object({
  message: chatMessageSchema,
})

const privacyLinkMessageResponseSchema = z.object({
  message: privacyLinkMessageSchema,
})

const realtimeSessionResponseSchema = z.object({
  realtimeSession: realtimeSessionBootstrapSchema,
})

const getSessionToken = (
  cookie: Record<string, { value: unknown }>,
): string | undefined => {
  const cookieValue = cookie[PERSONAL_CHAT_SESSION_COOKIE]?.value
  return typeof cookieValue === "string" ? cookieValue : undefined
}

const setSessionCookie = (
  cookie: Record<
    string,
    {
      set: (
        config: Record<string, unknown> | ((value: Record<string, unknown>) => Record<string, unknown>),
      ) => unknown
    }
  >,
  sessionToken: string,
) => {
  cookie[PERSONAL_CHAT_SESSION_COOKIE].set({
    value: sessionToken,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PERSONAL_CHAT_SESSION_TTL_SECONDS,
  })
}

const clearSessionCookie = (
  cookie: Record<
    string,
    {
      set: (
        config: Record<string, unknown> | ((value: Record<string, unknown>) => Record<string, unknown>),
      ) => unknown
    }
  >,
) => {
  cookie[PERSONAL_CHAT_SESSION_COOKIE].set({
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    maxAge: 0,
  })
}

const personalChatApiBase = new Elysia({ prefix: "/personal" })
  .error({
    PersonalChatConversationNotFoundError,
    PersonalChatBadRequestError,
    PersonalChatUnauthorizedError,
    PersonalChatInvalidCredentialsError,
    PersonalChatParticipantNotFoundError,
  })
  .onError(({ code, error, set }) => {
    if (code === "PersonalChatConversationNotFoundError") {
      set.status = 404

      return {
        error: "Conversation not found" as const,
        conversationId:
          error instanceof PersonalChatConversationNotFoundError
            ? error.conversationId
            : "unknown",
        }
    }

    if (code === "PersonalChatParticipantNotFoundError") {
      set.status = 404

      return {
        error: "Participant not found" as const,
        participantId:
          error instanceof PersonalChatParticipantNotFoundError
            ? error.participantId
            : "unknown",
      }
    }

    if (code === "PersonalChatUnauthorizedError") {
      set.status = 401

      return {
        error: "Unauthorized" as const,
      }
    }

    if (code === "PersonalChatInvalidCredentialsError") {
      set.status = 401

      return {
        error: "Invalid email or password" as const,
      }
    }

    if (code === "PersonalChatBadRequestError") {
      set.status = 400

      return {
        error:
          error instanceof PersonalChatBadRequestError
            ? error.message
            : "Bad request",
      }
    }
  })

export const personalChatApi = personalChatApiBase
  .get(
    "/",
    () => ({
      feature: "personal-chat" as const,
      status: "scaffolded" as const,
    }),
    {
      response: statusSchema,
    },
  )
  .get(
    "/session",
    async ({ cookie }) => {
      const service = getPersonalChatService()
      const session = await service.getSession({
        sessionToken: getSessionToken(cookie),
      })

      return { session }
    },
    {
      response: sessionResponseSchema,
    },
  )
  .get(
    "/dm-candidates",
    async ({ cookie }) => {
      const service = getPersonalChatService()
      const candidates = await service.getDmCandidates({
        sessionToken: getSessionToken(cookie),
      })

      return { candidates }
    },
    {
      response: {
        200: dmCandidatesResponseSchema,
        401: unauthorizedSchema,
      },
    },
  )
  .get(
    "/conversations",
    async ({ cookie }) => {
      const service = getPersonalChatService()
      const conversations = await service.getConversationSummaries({
        sessionToken: getSessionToken(cookie),
      })

      return { conversations }
    },
    {
      response: {
        200: conversationListResponseSchema,
        401: unauthorizedSchema,
      },
    },
  )
  .get(
    "/conversations/:conversationId",
    async ({ cookie, params }) => {
      const service = getPersonalChatService()
      const conversation = await service.getConversationDetail(
        { sessionToken: getSessionToken(cookie) },
        params.conversationId,
      )

      return { conversation }
    },
    {
      params: z.object({
        conversationId: z.string().min(1),
      }),
      response: {
        200: conversationResponseSchema,
        401: unauthorizedSchema,
        404: conversationNotFoundSchema,
      },
    },
  )
  .post(
    "/login",
    async ({ body, cookie }) => {
      const service = getPersonalChatService()
      const result = await service.login(body)

      setSessionCookie(cookie, result.sessionToken)

      return { session: result.session }
    },
    {
      body: loginBodySchema,
      response: {
        200: sessionResponseSchema,
        401: invalidCredentialsSchema,
      },
    },
  )
  .post(
    "/logout",
    async ({ cookie }) => {
      const service = getPersonalChatService()
      await service.logout({
        sessionToken: getSessionToken(cookie),
      })

      clearSessionCookie(cookie)

      return { success: true as const }
    },
    {
      response: logoutResponseSchema,
    },
  )
  .post(
    "/direct-conversations",
    async ({ body, cookie }) => {
      const service = getPersonalChatService()
      const conversation = await service.openOrCreateDirectConversation(
        { sessionToken: getSessionToken(cookie) },
        body,
      )

      return { conversation }
    },
    {
      body: directConversationBodySchema,
      response: {
        200: directConversationResponseSchema,
        400: badRequestSchema,
        401: unauthorizedSchema,
        404: participantNotFoundSchema,
      },
    },
  )
  .post(
    "/conversations/:conversationId/messages",
    async ({ body, cookie, params }) => {
      const service = getPersonalChatService()
      const message = await service.sendMessage(
        { sessionToken: getSessionToken(cookie) },
        {
          conversationId: params.conversationId,
          text: body.text,
          clientMessageId: body.clientMessageId,
        },
      )

      return { message }
    },
    {
      params: z.object({
        conversationId: z.string().min(1),
      }),
      body: sendMessageBodySchema,
      response: {
        200: messageResponseSchema,
        400: badRequestSchema,
        401: unauthorizedSchema,
        404: conversationNotFoundSchema,
      },
    },
  )
  .post(
    "/conversations/:conversationId/privacy-room-link",
    async ({ body, cookie, params }) => {
      const service = getPersonalChatService()
      const message = await service.createPrivacyRoomLink(
        { sessionToken: getSessionToken(cookie) },
        {
          conversationId: params.conversationId,
          clientMessageId: body.clientMessageId,
        },
      )

      return { message }
    },
    {
      params: z.object({
        conversationId: z.string().min(1),
      }),
      body: privacyRoomLinkBodySchema,
      response: {
        200: privacyLinkMessageResponseSchema,
        400: badRequestSchema,
        401: unauthorizedSchema,
        404: conversationNotFoundSchema,
      },
    },
  )
  .post(
    "/realtime/session",
    async ({ body, cookie }) => {
      const service = getPersonalChatService()
      const realtimeSession = await service.createRealtimeSession(
        { sessionToken: getSessionToken(cookie) },
        body,
      )

      return { realtimeSession }
    },
    {
      body: realtimeSessionBodySchema,
      response: {
        200: realtimeSessionResponseSchema,
        401: unauthorizedSchema,
        404: conversationNotFoundSchema,
      },
    },
  )
