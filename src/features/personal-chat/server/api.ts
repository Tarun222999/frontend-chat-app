import { Elysia } from "elysia"

export const personalChatApi = new Elysia({ prefix: "/personal" }).get(
  "/",
  () => ({
    feature: "personal-chat",
    status: "scaffolded" as const,
  }),
)
