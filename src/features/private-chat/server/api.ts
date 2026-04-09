import { nanoid } from "nanoid"
import { Elysia } from "elysia"
import z from "zod"
import { redis } from "@/lib/redis"
import { Message, realtime } from "@/lib/realtime"
import { authMiddleware } from "./auth-middleware"
import { createPrivateRoom } from "./create-private-room"

const roomsApi = new Elysia({ prefix: "/room" })
  .post("/create", () => createPrivateRoom())
  .use(authMiddleware)
  .get(
    "/ttl",
    async ({ auth }) => {
      const key = `meta:${auth.roomId}`
      const ttl = await redis.ttl(key)

      if (ttl <= 0) {
        return {
          destroyed: true,
          expiresAt: null,
          serverTime: Date.now(),
        }
      }

      const serverTime = Date.now()
      const expiresAt = serverTime + ttl * 1000

      return {
        destroyed: false,
        expiresAt,
        serverTime,
      }
    },
    {
      query: z.object({ roomId: z.string() }),
    },
  )
  .delete(
    "/",
    async ({ auth }) => {
      await realtime.channel(auth.roomId).emit("chat.destroy", {
        isDestroyed: true,
      })

      await Promise.all([
        redis.del(auth.roomId),
        redis.del(`meta:${auth.roomId}`),
        redis.del(`message:${auth.roomId}`),
      ])
    },
    {
      query: z.object({ roomId: z.string() }),
    },
  )

const messagesApi = new Elysia({ prefix: "/messages" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth }) => {
      const { sender, text } = body
      const { roomId } = auth

      const roomExists = await redis.exists(`meta:${roomId}`)

      if (!roomExists) {
        throw new Error("Room does not exist")
      }

      const message: Message = {
        id: nanoid(),
        sender,
        text,
        timeStamp: Date.now(),
        roomId,
      }

      await redis.rpush(`message:${roomId}`, {
        ...message,
        token: auth.token,
      })
      await realtime.channel(roomId).emit("chat.message", message)

      const remaining = await redis.ttl(`meta:${roomId}`)

      await redis.expire(`message:${roomId}`, remaining)
      await redis.expire(`history:${roomId}`, remaining)
      await redis.expire(roomId, remaining)
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({
        sender: z.string().max(100),
        text: z.string().max(5000),
      }),
    },
  )
  .get(
    "/",
    async ({ auth }) => {
      const messages = await redis.lrange<Message>(`message:${auth.roomId}`, 0, -1)

      return {
        messages: messages.map((message) => ({
          ...message,
          token: message.token === auth.token ? auth.token : undefined,
        })),
      }
    },
    {
      query: z.object({ roomId: z.string() }),
    },
  )

export const privateChatApi = new Elysia().use(roomsApi).use(messagesApi)
