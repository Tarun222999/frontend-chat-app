import { Redis } from "@upstash/redis"

type RedisClient = ReturnType<typeof Redis.fromEnv>

let cachedRedisClient: RedisClient | undefined

const getRedisClient = (): RedisClient => {
  if (!cachedRedisClient) {
    cachedRedisClient = Redis.fromEnv()
  }

  return cachedRedisClient
}

export const redis: RedisClient = new Proxy({} as RedisClient, {
  get(_target, property) {
    const client = getRedisClient()
    const value = Reflect.get(client, property)

    if (typeof value === "function") {
      return value.bind(client)
    }

    return value
  },
})
