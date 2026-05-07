import { nanoid } from "nanoid"
import { Elysia } from "elysia"
import z from "zod"
import { redis } from "@/lib/redis"
import { Message, realtime } from "@/lib/realtime"
import { logger } from "@/lib/logger"
import { authMiddleware } from "./auth-middleware"
import { createPrivateRoom } from "./create-private-room"
import { deletePrivateRoom } from "./delete-private-room"

const roomsApi = new Elysia({ prefix: "/room" })
  .post("/create", async () => {
    try {
      const room = await createPrivateRoom()

      logger.info("Private room created", {
        roomId: room.roomId,
      })

      return room
    } catch (error) {
      logger.error("Private room creation failed", { error })
      throw error
    }
  })
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
      try {
        await realtime.channel(auth.roomId).emit("chat.destroy", {
          isDestroyed: true,
        })

        await deletePrivateRoom(auth.roomId)

        logger.info("Private room destroyed", {
          roomId: auth.roomId,
        })
      } catch (error) {
        logger.error("Private room destruction failed", {
          roomId: auth.roomId,
          error,
        })
        throw error
      }
    },
    {
      query: z.object({ roomId: z.string() }),
    },
  )

const messagesApi = new Elysia({ prefix: "/messages" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth, set }) => {
      const { sender, text } = body
      const { roomId } = auth

      try {
        const roomExists = await redis.exists(`meta:${roomId}`)

        if (!roomExists) {
          set.status = 404
          logger.warn("Private room message rejected because room was missing", {
            roomId,
          })
          return {
            error: "Room not found",
            roomId,
          }
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

        logger.info("Private room message sent", {
          roomId,
          messageId: message.id,
        })
      } catch (error) {
        logger.error("Private room message send failed", {
          roomId,
          error,
        })
        throw error
      }
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
