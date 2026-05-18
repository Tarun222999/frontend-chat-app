CREATE TYPE "public"."ai_message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."ai_message_status" AS ENUM('pending', 'streaming', 'complete', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ai_model_profile" AS ENUM('free', 'fast', 'balanced');--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"model_profile" "ai_model_profile" NOT NULL,
	"model_provider" text NOT NULL,
	"model_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"status" "ai_message_status" NOT NULL,
	"model_profile" "ai_model_profile",
	"model_provider" text,
	"model_id" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_conversations_user_updated_idx" ON "ai_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "ai_conversations_user_deleted_idx" ON "ai_conversations" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_conversations_id_user_id_idx" ON "ai_conversations" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_user_id_fk" FOREIGN KEY ("conversation_id","user_id") REFERENCES "public"."ai_conversations"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_created_idx" ON "ai_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_messages_user_created_idx" ON "ai_messages" USING btree ("user_id","created_at");
