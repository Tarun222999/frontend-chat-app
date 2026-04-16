import { nanoid } from "nanoid"
import { redis } from "../../../lib/redis.ts"
import type {
  RealtimeSessionBootstrap,
  SessionUser,
} from "@/features/personal-chat/domain"
import { personalChatServerConfig } from "./config.ts"

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

export interface GatewayPersonalChatSessionStore {
  create(input: {
    accessToken: string
    refreshToken: string
    user: SessionUser
  }): Promise<GatewayPersonalChatSessionRecord>
  get(
    sessionToken?: string | null,
  ): Promise<GatewayPersonalChatSessionRecord | null>
  update(
    sessionToken: string,
    input: Partial<
      Pick<
        GatewayPersonalChatSessionRecord,
        "accessToken" | "refreshToken" | "user"
      >
    >,
  ): Promise<GatewayPersonalChatSessionRecord | null>
  delete(sessionToken?: string | null): Promise<void>
  createRealtimeBridgeSession(input: {
    accessToken: string
    conversationId: string
  }): Promise<RealtimeSessionBootstrap>
  getRealtimeBridgeSession(
    sessionId: string,
  ): Promise<GatewayRealtimeBridgeRecord | null>
}

export interface GatewaySessionStoreRedisClient {
  del(...args: unknown[]): Promise<unknown>
  expire(...args: unknown[]): Promise<unknown>
  get(...args: unknown[]): Promise<unknown>
  set(...args: unknown[]): Promise<unknown>
}

const createTimestamp = () => new Date().toISOString()
let gatewaySessionStoreRedisClient: GatewaySessionStoreRedisClient = redis

const sessionKey = (sessionToken: string) =>
  `personal-chat:gateway-session:${sessionToken}`

const realtimeBridgeKey = (sessionId: string) =>
  `personal-chat:gateway-realtime:${sessionId}`

const serializeRecord = (value: unknown) => JSON.stringify(value)
const touchRedisSessionTtl = async (sessionToken: string) => {
  await gatewaySessionStoreRedisClient.expire(
    sessionKey(sessionToken),
    personalChatServerConfig.gatewaySessionTtlSeconds,
  )
}

const parseRecord = <T>(value: unknown): T | null => {
  if (value == null) {
    return null
  }

  // Upstash can automatically deserialize JSON values on reads, so support
  // both the raw string shape from tests and the object shape from production.
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }

  if (typeof value === "object") {
    return value as T
  }

  return null
}

export const gatewayPersonalChatSessionStore = {
  async create(input: {
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

    await gatewaySessionStoreRedisClient.set(
      sessionKey(sessionToken),
      serializeRecord(record),
      {
        ex: personalChatServerConfig.gatewaySessionTtlSeconds,
      },
    )

    return record
  },

  async get(sessionToken?: string | null) {
    if (!sessionToken) {
      return null
    }

    const storedRecord = await gatewaySessionStoreRedisClient.get(
      sessionKey(sessionToken),
    )
    const sessionRecord = parseRecord<GatewayPersonalChatSessionRecord>(storedRecord)

    if (sessionRecord) {
      await touchRedisSessionTtl(sessionToken)
    }

    return sessionRecord
  },

  async update(
    sessionToken: string,
    input: Partial<
      Pick<GatewayPersonalChatSessionRecord, "accessToken" | "refreshToken" | "user">
    >,
  ) {
    const existing = await gatewayPersonalChatSessionStore.get(sessionToken)

    if (!existing) {
      return null
    }

    const updated: GatewayPersonalChatSessionRecord = {
      ...existing,
      ...input,
      updatedAt: createTimestamp(),
    }

    await gatewaySessionStoreRedisClient.set(
      sessionKey(sessionToken),
      serializeRecord(updated),
      {
        ex: personalChatServerConfig.gatewaySessionTtlSeconds,
      },
    )

    return updated
  },

  async delete(sessionToken?: string | null) {
    if (sessionToken) {
      await gatewaySessionStoreRedisClient.del(sessionKey(sessionToken))
    }
  },

  async createRealtimeBridgeSession(input: {
    accessToken: string
    conversationId: string
  }) {
    const issuedAt = createTimestamp()
    const expiresAt = new Date(
      Date.now() +
        personalChatServerConfig.gatewayRealtimeBridgeTtlSeconds * 1000,
    ).toISOString()
    const bootstrap: RealtimeSessionBootstrap = {
      provider: "gateway",
      sessionId: `gateway-rt-${nanoid(16)}`,
      conversationId: input.conversationId,
      channel: `conversation:${input.conversationId}`,
      issuedAt,
      expiresAt,
    }

    const record: GatewayRealtimeBridgeRecord = {
      bootstrap,
      accessToken: input.accessToken,
    }

    await gatewaySessionStoreRedisClient.set(
      realtimeBridgeKey(bootstrap.sessionId),
      serializeRecord(record),
      {
        ex: personalChatServerConfig.gatewayRealtimeBridgeTtlSeconds,
      },
    )

    return bootstrap
  },

  async getRealtimeBridgeSession(sessionId: string) {
    const storedRecord = await gatewaySessionStoreRedisClient.get(
      realtimeBridgeKey(sessionId),
    )
    return parseRecord<GatewayRealtimeBridgeRecord>(storedRecord)
  },
} satisfies GatewayPersonalChatSessionStore

export const setGatewaySessionStoreRedisClientForTests = (
  client: GatewaySessionStoreRedisClient,
) => {
  gatewaySessionStoreRedisClient = client
}

export const resetGatewaySessionStoreRedisClientForTests = () => {
  gatewaySessionStoreRedisClient = redis
}
