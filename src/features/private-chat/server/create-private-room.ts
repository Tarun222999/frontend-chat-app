import { nanoid } from "nanoid"
import { redis } from "@/lib/redis"

const ROOM_TTL_SECONDS = 60 * 10

export const createPrivateRoom = async () => {
  const roomId = nanoid()
  const transaction = redis.multi()

  transaction.hset(`meta:${roomId}`, {
    connected: [],
    createdAt: Date.now(),
  })
  transaction.expire(`meta:${roomId}`, ROOM_TTL_SECONDS)
  await transaction.exec()

  return { roomId }
}
