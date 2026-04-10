import { nanoid } from "nanoid"
import type {
  RealtimeSessionBootstrap,
  SessionUser,
} from "@/features/personal-chat/domain"

export interface GatewayPersonalChatSessionRecord {
  sessionToken: string
  accessToken: string
  refreshToken: string
  user: SessionUser
  createdAt: string
  updatedAt: string
}

interface GatewayRealtimeBridgeRecord {
  bootstrap: RealtimeSessionBootstrap
  accessToken: string
}

const sessions = new Map<string, GatewayPersonalChatSessionRecord>()
const realtimeBridgeSessions = new Map<string, GatewayRealtimeBridgeRecord>()

const createTimestamp = () => new Date().toISOString()
const isExpired = (isoTimestamp: string) =>
  Number.isFinite(Date.parse(isoTimestamp)) && Date.parse(isoTimestamp) <= Date.now()

const cleanupExpiredRealtimeBridgeSessions = () => {
  for (const [sessionId, record] of realtimeBridgeSessions.entries()) {
    if (isExpired(record.bootstrap.expiresAt)) {
      realtimeBridgeSessions.delete(sessionId)
    }
  }
}

export const gatewayPersonalChatSessionStore = {
  create(input: {
    accessToken: string
    refreshToken: string
    user: SessionUser
  }) {
    const now = createTimestamp()
    const sessionToken = `gateway-session-${nanoid(16)}`
    const record: GatewayPersonalChatSessionRecord = {
      sessionToken,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      user: input.user,
      createdAt: now,
      updatedAt: now,
    }

    sessions.set(sessionToken, record)
    return record
  },

  get(sessionToken?: string | null) {
    if (!sessionToken) {
      return null
    }

    return sessions.get(sessionToken) ?? null
  },

  update(
    sessionToken: string,
    input: Partial<
      Pick<GatewayPersonalChatSessionRecord, "accessToken" | "refreshToken" | "user">
    >,
  ) {
    const existing = sessions.get(sessionToken)

    if (!existing) {
      return null
    }

    const updated: GatewayPersonalChatSessionRecord = {
      ...existing,
      ...input,
      updatedAt: createTimestamp(),
    }

    sessions.set(sessionToken, updated)
    return updated
  },

  delete(sessionToken?: string | null) {
    if (sessionToken) {
      sessions.delete(sessionToken)
    }
  },

  createRealtimeBridgeSession(input: {
    accessToken: string
    conversationId: string
  }) {
    cleanupExpiredRealtimeBridgeSessions()

    const issuedAt = createTimestamp()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const bootstrap: RealtimeSessionBootstrap = {
      provider: "gateway",
      sessionId: `gateway-rt-${nanoid(16)}`,
      conversationId: input.conversationId,
      channel: `conversation:${input.conversationId}`,
      issuedAt,
      expiresAt,
    }

    realtimeBridgeSessions.set(bootstrap.sessionId, {
      bootstrap,
      accessToken: input.accessToken,
    })

    return bootstrap
  },

  getRealtimeBridgeSession(sessionId: string) {
    cleanupExpiredRealtimeBridgeSessions()
    return realtimeBridgeSessions.get(sessionId) ?? null
  },
}
