"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ConversationSummary } from "@/features/personal-chat/domain"
import {
  createPersonalChatPrivacyRoomLink,
  createPersonalChatRealtimeSession,
  getConversationDetail,
  getConversationSummaries,
  getDmCandidates,
  getPersonalSession,
  loginToPersonalChat,
  registerToPersonalChat,
  logoutFromPersonalChat,
  openOrCreatePersonalChatDirectConversation,
  type CreatePersonalChatPrivacyRoomLinkInput,
  type CreatePersonalChatRealtimeSessionInput,
  type OpenPersonalChatDirectConversationInput,
  type PersonalChatLoginInput,
  type PersonalChatRegisterInput,
  type SendPersonalChatMessageInput,
  sendPersonalChatMessage,
} from "./personal-chat-api"
import {
  unauthenticatedPersonalSession,
  updateConversationMessageCaches,
  upsertConversationSummary,
} from "./cache"
import { personalChatQueryKeys } from "./query-keys"

export const usePersonalSessionQuery = () =>
  useQuery({
    queryKey: personalChatQueryKeys.session(),
    queryFn: getPersonalSession,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

export const useDmCandidatesQuery = () =>
  useQuery({
    queryKey: personalChatQueryKeys.dmCandidates(),
    queryFn: getDmCandidates,
  })

export const useConversationSummariesQuery = () =>
  useQuery({
    queryKey: personalChatQueryKeys.conversations(),
    queryFn: getConversationSummaries,
  })

export const useConversationDetailQuery = (conversationId: string) =>
  useQuery({
    queryKey: personalChatQueryKeys.conversationDetail(conversationId),
    queryFn: () => getConversationDetail(conversationId),
    enabled: conversationId.length > 0,
  })

export const usePersonalLoginMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: PersonalChatLoginInput) => loginToPersonalChat(input),
    onSuccess: async (session) => {
      queryClient.setQueryData(personalChatQueryKeys.session(), session)

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: personalChatQueryKeys.session(),
        }),
        queryClient.invalidateQueries({
          queryKey: personalChatQueryKeys.dmCandidates(),
        }),
        queryClient.invalidateQueries({
          queryKey: personalChatQueryKeys.conversations(),
        }),
      ])
    },
  })
}

export const usePersonalRegisterMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: PersonalChatRegisterInput) => registerToPersonalChat(input),
    onSuccess: async (session) => {
      queryClient.setQueryData(personalChatQueryKeys.session(), session)

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: personalChatQueryKeys.session(),
        }),
        queryClient.invalidateQueries({
          queryKey: personalChatQueryKeys.dmCandidates(),
        }),
        queryClient.invalidateQueries({
          queryKey: personalChatQueryKeys.conversations(),
        }),
      ])
    },
  })
}

export const usePersonalLogoutMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logoutFromPersonalChat,
    onSuccess: async () => {
      queryClient.removeQueries({
        queryKey: personalChatQueryKeys.dmCandidates(),
      })
      queryClient.removeQueries({
        queryKey: personalChatQueryKeys.conversations(),
      })
      queryClient.setQueryData(
        personalChatQueryKeys.session(),
        unauthenticatedPersonalSession,
      )

      await queryClient.invalidateQueries({
        queryKey: personalChatQueryKeys.session(),
      })
    },
  })
}

export const useOpenDirectConversationMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: OpenPersonalChatDirectConversationInput) =>
      openOrCreatePersonalChatDirectConversation(input),
    onSuccess: (conversation) => {
      queryClient.setQueryData<ConversationSummary[] | undefined>(
        personalChatQueryKeys.conversations(),
        (currentConversations) =>
          upsertConversationSummary(currentConversations ?? [], conversation),
      )
    },
  })
}

export const useSendPersonalChatMessageMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SendPersonalChatMessageInput) =>
      sendPersonalChatMessage(input),
    onSuccess: (message) => {
      updateConversationMessageCaches(queryClient, message)
    },
  })
}

export const useCreatePrivacyRoomLinkMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePersonalChatPrivacyRoomLinkInput) =>
      createPersonalChatPrivacyRoomLink(input),
    onSuccess: (message) => {
      updateConversationMessageCaches(queryClient, message)
    },
  })
}

export const useCreatePersonalChatRealtimeSessionMutation = () =>
  useMutation({
    mutationFn: (input: CreatePersonalChatRealtimeSessionInput) =>
      createPersonalChatRealtimeSession(input),
  })
