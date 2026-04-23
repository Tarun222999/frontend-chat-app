"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import type {
  ChatMessage,
  MessageErrorEvent,
  MessageSendAck,
  RealtimeConnectionState,
} from "@/features/personal-chat/domain"
import { useCreatePersonalChatRealtimeSessionMutation } from "./hooks"
import type { SendRealtimeMessageInput } from "./realtime-adapter"
import {
  createRealtimeAdapterForBootstrap,
  type ActiveRealtimeBinding,
  type RealtimeJoinState,
  cleanupRealtimeBinding,
  emptyRealtimeBinding,
  fallbackConnectionState,
  fallbackJoinState,
  getThreadErrorMessage,
  isRealtimeSendReady,
  joiningRealtimeState,
} from "./personal-conversation-shared"

export function usePersonalConversationRealtime({
  conversationId,
  enabled,
  onRealtimeMessage,
  onRealtimeError,
}: {
  conversationId: string
  enabled: boolean
  onRealtimeMessage: (message: ChatMessage) => void
  onRealtimeError: (payload: MessageErrorEvent) => void
}) {
  const createRealtimeSessionMutation = useCreatePersonalChatRealtimeSessionMutation()
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>(
    fallbackConnectionState,
  )
  const [joinState, setJoinState] = useState<RealtimeJoinState>(fallbackJoinState)
  const activeRealtimeBindingRef = useRef<ActiveRealtimeBinding>(emptyRealtimeBinding)
  const rejoinAttemptTokenRef = useRef(0)
  const isRejoinInFlightRef = useRef(false)

  const handleRealtimeMessage = useEffectEvent((message: ChatMessage) => {
    if (message.conversationId !== conversationId) {
      return
    }

    onRealtimeMessage(message)
  })

  const handleRealtimeFailure = useEffectEvent((payload: MessageErrorEvent) => {
    if (payload.conversationId && payload.conversationId !== conversationId) {
      return
    }

    onRealtimeError(payload)
  })

  const rejoinActiveConversation = useEffectEvent(async () => {
    const activeRealtimeBinding = activeRealtimeBindingRef.current
    const realtimeAdapter = activeRealtimeBinding.adapter

    if (
      !realtimeAdapter ||
      activeRealtimeBinding.joinedConversationId !== conversationId ||
      connectionState.status !== "connected" ||
      joinState.status !== "joining" ||
      isRejoinInFlightRef.current
    ) {
      return
    }

    isRejoinInFlightRef.current = true
    const attemptToken = ++rejoinAttemptTokenRef.current

    try {
      const joinAck = await realtimeAdapter.joinConversation({ conversationId })

      if (
        attemptToken !== rejoinAttemptTokenRef.current ||
        activeRealtimeBindingRef.current.adapter !== realtimeAdapter ||
        activeRealtimeBindingRef.current.joinedConversationId !== conversationId
      ) {
        return
      }

      if (!joinAck.ok) {
        setJoinState({
          status: "error",
          lastError: joinAck.error,
        })
        return
      }

      setJoinState({
        status: "joined",
        lastError: null,
      })
    } finally {
      if (attemptToken === rejoinAttemptTokenRef.current) {
        isRejoinInFlightRef.current = false
      }
    }
  })

  const bootstrapRealtimeSession = useEffectEvent(async () => {
    setConnectionState({
      status: "connecting",
      lastError: null,
    })
    setJoinState(joiningRealtimeState)

    const bootstrap = await createRealtimeSessionMutation.mutateAsync({
      conversationId,
    })
    const adapter = createRealtimeAdapterForBootstrap(bootstrap)
    const offConnection = adapter.onConnectionStateChange((state) => {
      setConnectionState(state)

      if (state.status !== "connected" && activeRealtimeBindingRef.current.adapter === adapter) {
        setJoinState(joiningRealtimeState)
      }
    })
    const offNewMessage = adapter.on("message:new", ({ message }) => {
      handleRealtimeMessage(message)
    })
    const offMessageError = adapter.on("message:error", (payload) => {
      handleRealtimeFailure(payload)
    })

    await adapter.connect(bootstrap)
    const joinAck = await adapter.joinConversation({ conversationId })

    if (!joinAck.ok) {
      setJoinState({
        status: "error",
        lastError: joinAck.error,
      })
      await cleanupRealtimeBinding({
        adapter,
        joinedConversationId: null,
        release: () => {
          offConnection()
          offNewMessage()
          offMessageError()
        },
      })
      return emptyRealtimeBinding
    }

    setJoinState({
      status: "joined",
      lastError: null,
    })
    setConnectionState(adapter.getConnectionState())

    const activeBinding = {
      adapter,
      joinedConversationId: conversationId,
      release: () => {
        offConnection()
        offNewMessage()
        offMessageError()
      },
    } satisfies ActiveRealtimeBinding

    activeRealtimeBindingRef.current = activeBinding

    return activeBinding
  })

  useEffect(() => {
    if (!enabled) {
      setConnectionState(fallbackConnectionState)
      setJoinState(fallbackJoinState)
      activeRealtimeBindingRef.current = emptyRealtimeBinding
      rejoinAttemptTokenRef.current += 1
      isRejoinInFlightRef.current = false
      return
    }

    let cancelled = false
    let teardown = emptyRealtimeBinding

    setConnectionState(fallbackConnectionState)
    setJoinState(fallbackJoinState)
    activeRealtimeBindingRef.current = emptyRealtimeBinding

    void (async () => {
      try {
        teardown = await bootstrapRealtimeSession()

        if (cancelled && teardown.adapter) {
          activeRealtimeBindingRef.current = emptyRealtimeBinding
          void cleanupRealtimeBinding(teardown)
        }
      } catch (error) {
        activeRealtimeBindingRef.current = emptyRealtimeBinding
        if (!cancelled) {
          setConnectionState({
            status: "error",
            lastError: getThreadErrorMessage(error),
          })
          setJoinState({
            status: "error",
            lastError: null,
          })
        }
      }
    })()

    return () => {
      cancelled = true
      activeRealtimeBindingRef.current = emptyRealtimeBinding
      rejoinAttemptTokenRef.current += 1
      isRejoinInFlightRef.current = false
      void cleanupRealtimeBinding(teardown)
    }
  }, [conversationId, enabled])

  useEffect(() => {
    if (joinState.status !== "joining" || connectionState.status !== "connected") {
      return
    }

    void rejoinActiveConversation()
  }, [connectionState.status, conversationId, joinState.status])

  const sendRealtimeMessage = async (
    input: SendRealtimeMessageInput,
  ): Promise<MessageSendAck | null> => {
    const activeRealtimeBinding = activeRealtimeBindingRef.current
    const realtimeAdapter = activeRealtimeBinding.adapter

    if (
      !realtimeAdapter ||
      !isRealtimeSendReady(
        activeRealtimeBinding,
        input.conversationId,
        connectionState,
        joinState,
      )
    ) {
      return null
    }

    return realtimeAdapter.sendMessage(input)
  }

  return {
    connectionState,
    joinState,
    sendRealtimeMessage,
  }
}
