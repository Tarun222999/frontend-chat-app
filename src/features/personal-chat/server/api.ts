import { Elysia } from "elysia"
import { z } from "zod"
import {
  conversationDetailSchema,
  conversationSummarySchema,
  dmCandidateSchema,
  personalSessionSchema,
} from "@/features/personal-chat/domain"
import { getPersonalChatService } from "./get-personal-chat-service"
import { PersonalChatConversationNotFoundError } from "./personal-chat-service"

const statusSchema = z.object({
  feature: z.literal("personal-chat"),
  status: z.literal("scaffolded"),
})

const conversationNotFoundSchema = z.object({
  error: z.literal("Conversation not found"),
  conversationId: z.string(),
})

const personalChatApiBase = new Elysia({ prefix: "/personal" })
  .error({ PersonalChatConversationNotFoundError })
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
    async () => {
      const service = getPersonalChatService()
      const session = await service.getSession()

      return { session }
    },
    {
      response: z.object({
        session: personalSessionSchema,
      }),
    },
  )
  .get(
    "/dm-candidates",
    async () => {
      const service = getPersonalChatService()
      const candidates = await service.getDmCandidates()

      return { candidates }
    },
    {
      response: z.object({
        candidates: z.array(dmCandidateSchema),
      }),
    },
  )
  .get(
    "/conversations",
    async () => {
      const service = getPersonalChatService()
      const conversations = await service.getConversationSummaries()

      return { conversations }
    },
    {
      response: z.object({
        conversations: z.array(conversationSummarySchema),
      }),
    },
  )
  .get(
    "/conversations/:conversationId",
    async ({ params }) => {
      const service = getPersonalChatService()
      const conversation = await service.getConversationDetail(
        params.conversationId,
      )

      return { conversation }
    },
    {
      params: z.object({
        conversationId: z.string().min(1),
      }),
      response: {
        200: z.object({
          conversation: conversationDetailSchema,
        }),
        404: conversationNotFoundSchema,
      },
    },
  )
