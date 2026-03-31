import { Elysia } from "elysia"
import { personalChatApi } from "@/features/personal-chat/server/api"
import { privateChatApi } from "@/features/private-chat/server/api"

const app = new Elysia({ prefix: "/api" })
  .use(privateChatApi)
  .use(personalChatApi)

export const GET = app.fetch
export const POST = app.fetch
export const DELETE = app.fetch

export type App = typeof app
