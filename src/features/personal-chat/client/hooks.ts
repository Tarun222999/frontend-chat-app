"use client"

import { useQuery } from "@tanstack/react-query"
import {
  getConversationDetail,
  getConversationSummaries,
  getDmCandidates,
  getPersonalSession,
} from "./personal-chat-api"
import { personalChatQueryKeys } from "./query-keys"

export const usePersonalSessionQuery = () =>
  useQuery({
    queryKey: personalChatQueryKeys.session(),
    queryFn: getPersonalSession,
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
