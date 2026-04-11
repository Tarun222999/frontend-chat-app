import { redis } from "@/lib/redis"

export const deletePrivateRoom = async (roomId: string) => {
  await Promise.all([
    redis.del(roomId),
    redis.del(`meta:${roomId}`),
    redis.del(`message:${roomId}`),
    redis.del(`history:${roomId}`),
  ])
}
