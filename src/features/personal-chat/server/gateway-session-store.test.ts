import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"
import { personalChatServerConfig } from "./config.ts"
import {
  gatewayPersonalChatSessionStore,
  resetGatewaySessionStoreRedisClientForTests,
  setGatewaySessionStoreRedisClientForTests,
} from "./gateway-session-store.ts"

type RedisMethodMap = {
  del: (...args: unknown[]) => Promise<unknown>
  expire: (...args: unknown[]) => Promise<unknown>
  get: (...args: unknown[]) => Promise<unknown>
  set: (...args: unknown[]) => Promise<unknown>
}

const redisValues = new Map<string, string>()
const setCalls: Array<{
  key: string
  value: string
  ex?: number
}> = []
const expireCalls: Array<{
  key: string
  ttlSeconds: number
}> = []
const deleteCalls: string[] = []

const resetFakeRedis = () => {
  redisValues.clear()
  setCalls.length = 0
  expireCalls.length = 0
  deleteCalls.length = 0
}

const installFakeRedis = () => {
  const fakeRedis: RedisMethodMap = {
    get: async (...args: unknown[]) => {
      const [key] = args

      if (typeof key !== "string") {
        return null
      }

      return redisValues.get(key) ?? null
    },

    set: async (...args: unknown[]) => {
      const [key, value, options] = args as [
        unknown,
        unknown,
        { ex?: number } | undefined,
      ]

      if (typeof key !== "string" || typeof value !== "string") {
        throw new Error("Unexpected Redis set input in test")
      }

      redisValues.set(key, value)
      setCalls.push({
        key,
        value,
        ex: options?.ex,
      })

      return "OK"
    },

    del: async (...args: unknown[]) => {
      const [key] = args

      if (typeof key !== "string") {
        return 0
      }

      deleteCalls.push(key)
      redisValues.delete(key)
      return 1
    },

    expire: async (...args: unknown[]) => {
      const [key, ttlSeconds] = args

      if (typeof key !== "string" || typeof ttlSeconds !== "number") {
        return 0
      }

      expireCalls.push({
        key,
        ttlSeconds,
      })

      return redisValues.has(key) ? 1 : 0
    },
  }

  setGatewaySessionStoreRedisClientForTests(fakeRedis)
}

const installAutoDeserializingFakeRedis = () => {
  const fakeRedis: RedisMethodMap = {
    get: async (...args: unknown[]) => {
      const [key] = args

      if (typeof key !== "string") {
        return null
      }

      const stored = redisValues.get(key)

      if (!stored) {
        return null
      }

      return JSON.parse(stored)
    },

    set: async (...args: unknown[]) => {
      const [key, value, options] = args as [
        unknown,
        unknown,
        { ex?: number } | undefined,
      ]

      if (typeof key !== "string" || typeof value !== "string") {
        throw new Error("Unexpected Redis set input in test")
      }

      redisValues.set(key, value)
      setCalls.push({
        key,
        value,
        ex: options?.ex,
      })

      return "OK"
    },

    del: async (...args: unknown[]) => {
      const [key] = args

      if (typeof key !== "string") {
        return 0
      }

      deleteCalls.push(key)
      redisValues.delete(key)
      return 1
    },

    expire: async (...args: unknown[]) => {
      const [key, ttlSeconds] = args

      if (typeof key !== "string" || typeof ttlSeconds !== "number") {
        return 0
      }

      expireCalls.push({
        key,
        ttlSeconds,
      })

      return redisValues.has(key) ? 1 : 0
    },
  }

  setGatewaySessionStoreRedisClientForTests(fakeRedis)
}

const restoreRedis = () => {
  resetGatewaySessionStoreRedisClientForTests()
}

const sessionKey = (sessionToken: string) =>
  `personal-chat:gateway-session:${sessionToken}`

const realtimeBridgeKey = (sessionId: string) =>
  `personal-chat:gateway-realtime:${sessionId}`

describe("gatewayPersonalChatSessionStore", () => {
  beforeEach(() => {
    resetFakeRedis()
    installFakeRedis()
  })

  afterEach(() => {
    restoreRedis()
    resetFakeRedis()
  })

  it("creates a session record in Redis with the configured TTL", async () => {
    const record = await gatewayPersonalChatSessionStore.create({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "user-1",
        handle: "echo",
        displayName: "Echo",
        avatarUrl: null,
      },
    })

    assert.match(record.sessionToken, /^gateway-session-/)
    assert.equal(setCalls.length, 1)
    assert.equal(setCalls[0]?.key, sessionKey(record.sessionToken))
    assert.equal(
      setCalls[0]?.ex,
      personalChatServerConfig.gatewaySessionTtlSeconds,
    )
  })

  it("returns stored sessions and refreshes the sliding TTL on reads", async () => {
    const record = await gatewayPersonalChatSessionStore.create({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "user-2",
        handle: "foxtrot",
        displayName: "Foxtrot",
        avatarUrl: null,
      },
    })

    setCalls.length = 0

    const loaded = await gatewayPersonalChatSessionStore.get(record.sessionToken)

    assert.deepEqual(loaded, record)
    assert.deepEqual(expireCalls, [
      {
        key: sessionKey(record.sessionToken),
        ttlSeconds: personalChatServerConfig.gatewaySessionTtlSeconds,
      },
    ])
    assert.equal(setCalls.length, 0)
  })

  it("returns stored sessions when Redis auto-deserializes JSON values", async () => {
    const record = await gatewayPersonalChatSessionStore.create({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "user-2b",
        handle: "foxtrot-2",
        displayName: "Foxtrot Two",
        avatarUrl: null,
      },
    })

    setCalls.length = 0
    expireCalls.length = 0
    installAutoDeserializingFakeRedis()

    const loaded = await gatewayPersonalChatSessionStore.get(record.sessionToken)

    assert.deepEqual(loaded, record)
    assert.deepEqual(expireCalls, [
      {
        key: sessionKey(record.sessionToken),
        ttlSeconds: personalChatServerConfig.gatewaySessionTtlSeconds,
      },
    ])
    assert.equal(setCalls.length, 0)
  })

  it("updates stored sessions and rewrites the Redis value with the configured TTL", async () => {
    const record = await gatewayPersonalChatSessionStore.create({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "user-3",
        handle: "golf",
        displayName: "Golf",
        avatarUrl: null,
      },
    })

    setCalls.length = 0
    expireCalls.length = 0

    const updated = await gatewayPersonalChatSessionStore.update(
      record.sessionToken,
      {
        accessToken: "new-access-token",
      },
    )

    assert.equal(updated?.accessToken, "new-access-token")
    assert.equal(updated?.refreshToken, "refresh-token")
    assert.equal(updated?.createdAt, record.createdAt)
    assert.equal(typeof updated?.updatedAt, "string")
    assert.equal(
      Number.isFinite(Date.parse(updated?.updatedAt ?? "")),
      true,
    )
    assert.equal(
      Date.parse(updated?.updatedAt ?? "") >= Date.parse(record.updatedAt),
      true,
    )
    assert.equal(setCalls.length, 1)
    assert.equal(setCalls[0]?.key, sessionKey(record.sessionToken))
    assert.equal(
      setCalls[0]?.ex,
      personalChatServerConfig.gatewaySessionTtlSeconds,
    )
    assert.deepEqual(expireCalls, [
      {
        key: sessionKey(record.sessionToken),
        ttlSeconds: personalChatServerConfig.gatewaySessionTtlSeconds,
      },
    ])
  })

  it("deletes stored sessions from Redis", async () => {
    const record = await gatewayPersonalChatSessionStore.create({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "user-4",
        handle: "hotel",
        displayName: "Hotel",
        avatarUrl: null,
      },
    })

    await gatewayPersonalChatSessionStore.delete(record.sessionToken)

    assert.deepEqual(deleteCalls, [sessionKey(record.sessionToken)])
    assert.equal(redisValues.has(sessionKey(record.sessionToken)), false)
  })

  it("stores realtime bridge sessions with a fixed Redis TTL", async () => {
    const bootstrap = await gatewayPersonalChatSessionStore.createRealtimeBridgeSession(
      {
        accessToken: "access-token",
        conversationId: "conversation-1",
      },
    )

    assert.match(bootstrap.sessionId, /^gateway-rt-/)
    assert.equal(setCalls.length, 1)
    assert.equal(setCalls[0]?.key, realtimeBridgeKey(bootstrap.sessionId))
    assert.equal(
      setCalls[0]?.ex,
      personalChatServerConfig.gatewayRealtimeBridgeTtlSeconds,
    )

    const bridgeSession = await gatewayPersonalChatSessionStore.getRealtimeBridgeSession(
      bootstrap.sessionId,
    )

    assert.deepEqual(bridgeSession, {
      bootstrap,
      accessToken: "access-token",
    })
    assert.equal(expireCalls.length, 0)
  })
})
