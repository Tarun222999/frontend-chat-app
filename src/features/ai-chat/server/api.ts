import { Elysia } from "elysia"
import { z } from "zod"
import {
  aiConversationDetailResponseSchema,
  aiConversationMessagePageInputSchema,
  aiConversationResponseSchema,
  aiConversationSummariesResponseSchema,
  aiDeleteConversationResponseSchema,
  aiModelProfileSchema,
  createAiConversationInputSchema,
} from "@/features/ai-chat/domain"
import { getPersonalChatService } from "@/features/personal-chat/server/get-personal-chat-service"
import { getPersonalChatSessionToken } from "@/features/personal-chat/server/session-cookie"
import {
  AiConversationNotFoundError,
  AiMessageNotFoundError,
  createAiConversation,
  deleteAiConversation,
  getAiConversationDetail,
  listAiConversationSummaries,
  renameAiConversation,
} from "./storage"
import { streamAiMessage } from "./streaming"

class AiChatUnauthorizedError extends Error {
  constructor() {
    super("Unauthorized")
    this.name = "AiChatUnauthorizedError"
  }
}

class AiChatBadRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AiChatBadRequestError"
  }
}

const statusSchema = z.object({
  feature: z.literal("ai-chat"),
  status: z.literal("scaffolded"),
})

const conversationParamsSchema = z.object({
  conversationId: z.string().min(1),
})

const renameConversationBodySchema = z.object({
  title: z.string().trim().min(1).max(80),
})

const streamMessageBodySchema = z.object({
  text: z.string().trim().min(1).max(12000),
  modelProfile: aiModelProfileSchema,
  clientMessageId: z.string().min(1).optional(),
})

const unauthorizedSchema = z.object({
  error: z.literal("Unauthorized"),
})

const conversationNotFoundSchema = z.object({
  error: z.literal("Conversation not found"),
  conversationId: z.string(),
})

const badRequestSchema = z.object({
  error: z.string(),
})

const getAiApiUser = async (cookie: unknown) => {
  const service = getPersonalChatService()
  const session = await service.getSession({
    sessionToken: getPersonalChatSessionToken(
      cookie as Parameters<typeof getPersonalChatSessionToken>[0],
    ),
  })

  if (!session.isAuthenticated || !session.user) {
    throw new AiChatUnauthorizedError()
  }

  return session.user
}

const aiChatApiBase = new Elysia({ prefix: "/ai" })
  .error({
    AiChatUnauthorizedError,
    AiChatBadRequestError,
    AiConversationNotFoundError,
    AiMessageNotFoundError,
  })
  .onError(({ code, error, set }) => {
    if (code === "AiChatUnauthorizedError") {
      set.status = 401

      return {
        error: "Unauthorized" as const,
      }
    }

    if (code === "AiChatBadRequestError") {
      set.status = 400

      return {
        error:
          error instanceof AiChatBadRequestError ? error.message : "Bad request",
      }
    }

    if (code === "AiConversationNotFoundError") {
      set.status = 404

      return {
        error: "Conversation not found" as const,
        conversationId:
          error instanceof AiConversationNotFoundError
            ? error.conversationId
            : "unknown",
      }
    }

    if (code === "AiMessageNotFoundError") {
      set.status = 404

      return {
        error: "Message not found" as const,
        messageId:
          error instanceof AiMessageNotFoundError ? error.messageId : "unknown",
      }
    }
  })

export const aiChatApi = aiChatApiBase
  .get(
    "/",
    () => ({
      feature: "ai-chat" as const,
      status: "scaffolded" as const,
    }),
    {
      response: statusSchema,
    },
  )
  .get(
    "/conversations",
    async ({ cookie }) => {
      const user = await getAiApiUser(cookie)
      const conversations = await listAiConversationSummaries({
        userId: user.id,
      })

      return { conversations }
    },
    {
      response: {
        200: aiConversationSummariesResponseSchema,
        401: unauthorizedSchema,
      },
    },
  )
  .post(
    "/conversations",
    async ({ body, cookie }) => {
      const user = await getAiApiUser(cookie)
      const { conversation } = await createAiConversation(
        {
          userId: user.id,
        },
        body,
      )

      return { conversation }
    },
    {
      body: createAiConversationInputSchema,
      response: {
        200: aiConversationResponseSchema,
        401: unauthorizedSchema,
      },
    },
  )
  .get(
    "/conversations/:conversationId",
    async ({ cookie, params, query }) => {
      const user = await getAiApiUser(cookie)
      const conversation = await getAiConversationDetail(
        {
          userId: user.id,
        },
        params.conversationId,
        query,
      )

      return { conversation }
    },
    {
      params: conversationParamsSchema,
      query: aiConversationMessagePageInputSchema,
      response: {
        200: aiConversationDetailResponseSchema,
        401: unauthorizedSchema,
        404: conversationNotFoundSchema,
      },
    },
  )
  .post(
    "/conversations/:conversationId/rename",
    async ({ body, cookie, params }) => {
      const user = await getAiApiUser(cookie)
      const conversation = await renameAiConversation(
        {
          userId: user.id,
        },
        {
          conversationId: params.conversationId,
          title: body.title,
        },
      )

      return { conversation }
    },
    {
      params: conversationParamsSchema,
      body: renameConversationBodySchema,
      response: {
        200: aiConversationResponseSchema,
        401: unauthorizedSchema,
        404: conversationNotFoundSchema,
      },
    },
  )
  .delete(
    "/conversations/:conversationId",
    async ({ cookie, params }) => {
      const user = await getAiApiUser(cookie)

      await deleteAiConversation(
        {
          userId: user.id,
        },
        params.conversationId,
      )

      return { success: true as const }
    },
    {
      params: conversationParamsSchema,
      response: {
        200: aiDeleteConversationResponseSchema,
        401: unauthorizedSchema,
        404: conversationNotFoundSchema,
      },
    },
  )
  .post(
    "/conversations/:conversationId/messages/stream",
    async ({ body, cookie, params, request }) => {
      const user = await getAiApiUser(cookie)

      try {
        return await streamAiMessage(
          {
            userId: user.id,
          },
          {
            conversationId: params.conversationId,
            text: body.text,
            modelProfile: body.modelProfile,
            clientMessageId: body.clientMessageId,
            abortSignal: request.signal,
          },
        )
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("AI message is too long")
        ) {
          throw new AiChatBadRequestError(error.message)
        }

        throw error
      }
    },
    {
      params: conversationParamsSchema,
      body: streamMessageBodySchema,
      response: {
        400: badRequestSchema,
        401: unauthorizedSchema,
        404: conversationNotFoundSchema,
      },
    },
  )
