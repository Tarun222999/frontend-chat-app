import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const aiMessageRoleEnum = pgEnum("ai_message_role", [
  "user",
  "assistant",
  "system",
])

export const aiMessageStatusEnum = pgEnum("ai_message_status", [
  "pending",
  "streaming",
  "complete",
  "failed",
  "cancelled",
])

export const aiModelProfileEnum = pgEnum("ai_model_profile", [
  "free",
  "fast",
  "balanced",
])

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    modelProfile: aiModelProfileEnum("model_profile").notNull(),
    modelProvider: text("model_provider").notNull(),
    modelId: text("model_id").notNull(),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      withTimezone: true,
    }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => [
    index("ai_conversations_user_updated_idx").on(
      table.userId,
      table.updatedAt,
    ),
    index("ai_conversations_user_deleted_idx").on(
      table.userId,
      table.deletedAt,
    ),
  ],
)

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversations.id, {
        onDelete: "cascade",
      }),
    userId: text("user_id").notNull(),
    role: aiMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    status: aiMessageStatusEnum("status").notNull(),
    modelProfile: aiModelProfileEnum("model_profile"),
    modelProvider: text("model_provider"),
    modelId: text("model_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    index("ai_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    index("ai_messages_user_created_idx").on(table.userId, table.createdAt),
  ],
)

export type AiConversationRecord = typeof aiConversations.$inferSelect
export type NewAiConversationRecord = typeof aiConversations.$inferInsert
export type AiMessageRecord = typeof aiMessages.$inferSelect
export type NewAiMessageRecord = typeof aiMessages.$inferInsert
