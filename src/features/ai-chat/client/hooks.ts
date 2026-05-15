"use client"

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type { AiConversationSummary } from "@/features/ai-chat/domain"
import type { AiConversationMessagePageInput } from "@/features/ai-chat/domain"
import {
  createAiChatConversation,
  deleteAiChatConversation,
  getAiConversationDetail,
  getAiConversationSummaries,
  renameAiChatConversation,
  streamAiChatMessage,
  type CreateAiChatConversationInput,
  type RenameAiChatConversationInput,
  type StreamAiChatMessageInput,
} from "./ai-chat-api"
import { aiChatQueryKeys } from "./query-keys"

const upsertAiConversationSummary = (
  conversations: AiConversationSummary[],
  conversation: AiConversationSummary,
) => {
  const existingIndex = conversations.findIndex(
    (currentConversation) => currentConversation.id === conversation.id,
  )

  if (existingIndex === -1) {
    return [conversation, ...conversations]
  }

  return conversations.map((currentConversation, index) =>
    index === existingIndex ? conversation : currentConversation,
  )
}

export const useAiConversationSummariesQuery = () =>
  useQuery({
    queryKey: aiChatQueryKeys.conversations(),
    queryFn: getAiConversationSummaries,
  })

export const useAiConversationDetailQuery = (
  conversationId: string,
  page?: AiConversationMessagePageInput,
) =>
  useQuery({
    queryKey: aiChatQueryKeys.conversationDetail(conversationId, page),
    queryFn: () => getAiConversationDetail(conversationId, page),
    enabled: conversationId.length > 0,
  })

export const useCreateAiConversationMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateAiChatConversationInput) =>
      createAiChatConversation(input),
    onSuccess: (conversation) => {
      queryClient.setQueryData<AiConversationSummary[] | undefined>(
        aiChatQueryKeys.conversations(),
        (currentConversations) =>
          upsertAiConversationSummary(currentConversations ?? [], conversation),
      )
    },
  })
}

export const useRenameAiConversationMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: RenameAiChatConversationInput) =>
      renameAiChatConversation(input),
    onSuccess: (conversation) => {
      queryClient.setQueryData<AiConversationSummary[] | undefined>(
        aiChatQueryKeys.conversations(),
        (currentConversations) =>
          upsertAiConversationSummary(currentConversations ?? [], conversation),
      )
      void queryClient.invalidateQueries({
        queryKey: aiChatQueryKeys.conversationDetail(conversation.id),
      })
    },
  })
}

export const useDeleteAiConversationMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteAiChatConversation,
    onSuccess: async (_result, conversationId) => {
      queryClient.setQueryData<AiConversationSummary[] | undefined>(
        aiChatQueryKeys.conversations(),
        (currentConversations) =>
          (currentConversations ?? []).filter(
            (conversation) => conversation.id !== conversationId,
          ),
      )
      queryClient.removeQueries({
        queryKey: aiChatQueryKeys.conversationDetail(conversationId),
      })
    },
  })
}

export const useStreamAiMessageMutation = () =>
  useMutation({
    mutationFn: (input: StreamAiChatMessageInput) => streamAiChatMessage(input),
  })
