"use client"

import { z } from "zod"
import {
  conversationDetailSchema,
  conversationSummarySchema,
  dmCandidateSchema,
  personalSessionSchema,
} from "@/features/personal-chat/domain"

const personalSessionResponseSchema = z.object({
  session: personalSessionSchema,
})

const dmCandidatesResponseSchema = z.object({
  candidates: z.array(dmCandidateSchema),
})

const conversationSummariesResponseSchema = z.object({
  conversations: z.array(conversationSummarySchema),
})

const conversationDetailResponseSchema = z.object({
  conversation: conversationDetailSchema,
})

const apiErrorResponseSchema = z.object({
  error: z.string(),
  conversationId: z.string().optional(),
})

export class PersonalChatApiError extends Error {
  status: number
  details?: z.infer<typeof apiErrorResponseSchema>

  constructor(
    message: string,
    status: number,
    details?: z.infer<typeof apiErrorResponseSchema>,
  ) {
    super(message)
    this.name = "PersonalChatApiError"
    this.status = status
    this.details = details
  }
}

const readJson = async <TSchema extends z.ZodTypeAny>(
  response: Response,
  schema: TSchema,
): Promise<z.infer<TSchema>> => {
  const payload = await response.json()

  if (!response.ok) {
    const details = apiErrorResponseSchema.safeParse(payload)

    throw new PersonalChatApiError(
      details.success ? details.data.error : "Request failed",
      response.status,
      details.success ? details.data : undefined,
    )
  }

  return schema.parse(payload)
}

const fetchPersonalChat = async <TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
): Promise<z.infer<TSchema>> => {
  const response = await fetch(`/api/personal${path}`, {
    credentials: "same-origin",
    headers: {
      accept: "application/json",
    },
  })

  return readJson(response, schema)
}

export const getPersonalSession = async () => {
  const response = await fetchPersonalChat("/session", personalSessionResponseSchema)
  return response.session
}

export const getDmCandidates = async () => {
  const response = await fetchPersonalChat(
    "/dm-candidates",
    dmCandidatesResponseSchema,
  )

  return response.candidates
}

export const getConversationSummaries = async () => {
  const response = await fetchPersonalChat(
    "/conversations",
    conversationSummariesResponseSchema,
  )

  return response.conversations
}

export const getConversationDetail = async (conversationId: string) => {
  const encodedConversationId = encodeURIComponent(conversationId)
  const response = await fetchPersonalChat(
    `/conversations/${encodedConversationId}`,
    conversationDetailResponseSchema,
  )

  return response.conversation
}
