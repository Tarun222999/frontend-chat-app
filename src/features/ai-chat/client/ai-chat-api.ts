"use client"

import { z } from "zod"
import {
  aiApiErrorResponseSchema,
  aiConversationDetailResponseSchema,
  aiConversationResponseSchema,
  aiConversationSummariesResponseSchema,
  aiDeleteConversationResponseSchema,
} from "@/features/ai-chat/domain"
import type {
  AiConversationMessagePageInput,
  AiModelProfile,
} from "@/features/ai-chat/domain"

export interface CreateAiChatConversationInput {
  modelProfile?: AiModelProfile
  initialMessage?: string
  clientMessageId?: string
}

export interface RenameAiChatConversationInput {
  conversationId: string
  title: string
}

export interface StreamAiChatMessageInput {
  conversationId: string
  text: string
  modelProfile: AiModelProfile
  clientMessageId?: string
  signal?: AbortSignal
}

export interface StreamAiChatMessageResult {
  assistantMessageId: string | null
  response: Response
  text: ReadableStream<string>
}

export class AiChatApiError extends Error {
  status: number
  details?: z.infer<typeof aiApiErrorResponseSchema>

  constructor(
    message: string,
    status: number,
    details?: z.infer<typeof aiApiErrorResponseSchema>,
  ) {
    super(message)
    this.name = "AiChatApiError"
    this.status = status
    this.details = details
  }
}

const readJson = async <TSchema extends z.ZodTypeAny>(
  response: Response,
  schema: TSchema,
): Promise<z.infer<TSchema>> => {
  const rawPayload = await response.text()
  let payload: unknown

  try {
    payload = rawPayload ? JSON.parse(rawPayload) : null
  } catch (error) {
    if (!response.ok) {
      throw new AiChatApiError(
        `Request failed (${response.status})${rawPayload ? `: ${rawPayload}` : ""}`,
        response.status,
      )
    }

    throw error
  }

  if (!response.ok) {
    const details = aiApiErrorResponseSchema.safeParse(payload)

    throw new AiChatApiError(
      details.success ? details.data.error : "Request failed",
      response.status,
      details.success ? details.data : undefined,
    )
  }

  return schema.parse(payload)
}

const fetchAiChat = async <TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
  init?: RequestInit,
): Promise<z.infer<TSchema>> => {
  const headers = new Headers(init?.headers)

  if (!headers.has("accept")) {
    headers.set("accept", "application/json")
  }

  const response = await fetch(`/api/ai${path}`, {
    credentials: "same-origin",
    ...init,
    headers,
  })

  return readJson(response, schema)
}

const createTextDecoderStream = (body: ReadableStream<Uint8Array>) => {
  const decoder = new TextDecoder()

  return new ReadableStream<string>({
    async start(controller) {
      const reader = body.getReader()

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            const finalChunk = decoder.decode()

            if (finalChunk) {
              controller.enqueue(finalChunk)
            }

            controller.close()
            return
          }

          controller.enqueue(
            decoder.decode(value, {
              stream: true,
            }),
          )
        }
      } catch (error) {
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    },
  })
}

export const getAiConversationSummaries = async () => {
  const response = await fetchAiChat(
    "/conversations",
    aiConversationSummariesResponseSchema,
  )

  return response.conversations
}

export const createAiChatConversation = async (
  input: CreateAiChatConversationInput = {},
) => {
  const response = await fetchAiChat(
    "/conversations",
    aiConversationResponseSchema,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    },
  )

  return response.conversation
}

export const getAiConversationDetail = async (
  conversationId: string,
  input?: AiConversationMessagePageInput,
) => {
  const encodedConversationId = encodeURIComponent(conversationId)
  const searchParams = new URLSearchParams()

  if (typeof input?.limit === "number") {
    searchParams.set("limit", String(input.limit))
  }

  if (input?.before) {
    searchParams.set("before", input.before)
  }

  if (input?.after) {
    searchParams.set("after", input.after)
  }

  const query = searchParams.toString()
  const response = await fetchAiChat(
    `/conversations/${encodedConversationId}${query ? `?${query}` : ""}`,
    aiConversationDetailResponseSchema,
  )

  return response.conversation
}

export const renameAiChatConversation = async (
  input: RenameAiChatConversationInput,
) => {
  const encodedConversationId = encodeURIComponent(input.conversationId)
  const response = await fetchAiChat(
    `/conversations/${encodedConversationId}/rename`,
    aiConversationResponseSchema,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
      }),
    },
  )

  return response.conversation
}

export const deleteAiChatConversation = async (conversationId: string) => {
  const encodedConversationId = encodeURIComponent(conversationId)

  await fetchAiChat(
    `/conversations/${encodedConversationId}`,
    aiDeleteConversationResponseSchema,
    {
      method: "DELETE",
    },
  )
}

export const streamAiChatMessage = async (
  input: StreamAiChatMessageInput,
): Promise<StreamAiChatMessageResult> => {
  const encodedConversationId = encodeURIComponent(input.conversationId)
  const response = await fetch(
    `/api/ai/conversations/${encodedConversationId}/messages/stream`,
    {
      method: "POST",
      credentials: "same-origin",
      signal: input.signal,
      headers: {
        accept: "text/plain",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: input.text,
        modelProfile: input.modelProfile,
        clientMessageId: input.clientMessageId,
      }),
    },
  )

  if (!response.ok) {
    await readJson(response, aiApiErrorResponseSchema)
  }

  if (!response.body) {
    throw new AiChatApiError("AI response stream was empty", response.status)
  }

  return {
    response,
    assistantMessageId: response.headers.get("x-ai-assistant-message-id"),
    text: createTextDecoderStream(response.body),
  }
}
