# AI Chat V1 Design

## Goal

Add AI Chat as a first-class Pulse conversation space beside Personal Chat and Private Chat.

V1 should let authenticated users create persistent AI conversations, choose a simple model profile per message, stream assistant responses, and manage saved AI threads without adding a separate backend service or vector database.

## Product Scope

### Included in V1

- AI Chat inbox at `/ai`.
- Persistent AI conversations at `/ai/chat/[conversationId]`.
- Shared account login using the existing personal-chat session.
- New chat flow with starter prompts.
- Streaming assistant responses.
- Stop generating.
- Retry failed or cancelled assistant response.
- Copy assistant messages.
- Delete conversation.
- Auto-title from the first user message.
- Model profile selector:
  - Free: best zero-cost default.
  - Fast: low-latency provider.
  - Balanced: better quality when available.
- Server-side provider key handling.
- Basic user-level request limits and max input size.
- Mock mode for local development.

### Product Decisions

- Model selection is captured per assistant message.
- Conversations may keep a current/default model profile for composer convenience.
- Changing the selected profile affects only the next generated assistant response.
- Assistant message bubbles should show the profile used, using subtle metadata rather than prominent provider branding.
- Failed or cancelled partial assistant messages remain visible in the thread.
- Failed or cancelled partial assistant messages are stored with explicit status metadata.
- Request-limit storage is deferred until the final implementation step. Keep the limiting layer replaceable so it can use either database-backed limits or Upstash Redis.

### Excluded from V1

- Vector database.
- Embeddings.
- RAG/document Q&A.
- File uploads.
- AI access to Personal Chat history.
- AI access to encrypted Private Rooms.
- Cross-chat memory.
- Separate AI login.
- Standalone backend AI microservice.

## Architecture

V1 keeps the AI implementation inside this Next.js app.

```txt
Browser
  -> Next.js UI
  -> Next.js API routes / Elysia route layer
  -> AI chat service module
  -> Vercel AI SDK provider
  -> model provider
```

Persistent data lives in Neon Postgres.

```txt
Next.js server code
  -> Drizzle ORM
  -> Neon Postgres
```

The feature should still use clean internal service boundaries so it can be extracted later.

```txt
src/features/ai-chat/
  client/
  domain/
  server/
  mocks/
```

## Auth Strategy

AI Chat should use the existing account/session created by the current personal-chat login. There should not be a separate AI login.

An auth facade now exists under:

```txt
src/features/auth/
```

It wraps current personal-chat auth with neutral naming:

- `getAccountRouteSession`
- `requireAccountRouteSession`
- `redirectAuthenticatedAccountRoute`
- `useAccountSessionQuery`
- `useAccountLoginMutation`
- `useAccountRegisterMutation`
- `useAccountLogoutMutation`
- `buildAccountLoginRedirectPath`
- `resolveAccountLoginSuccessPath`

The account login redirect sanitizer accepts both `/personal` and `/ai` paths. This fixes the main blocker for routing unauthenticated AI users through the existing login page and returning them to AI Chat afterward.

## Current Limitations To Keep In Mind

### Login is still personal-branded

The route is still `/personal/login`, and the form copy says "Personal Chat" / "Enter Personal". This does not block V1, but before launch we should adjust user-facing copy toward "Pulse account" or "Account".

Decision:

- Keep route as `/personal/login` for now.
- Keep visible personal-branded copy for now.
- Revisit login copy when the login flow is unified.
- Later consider adding `/login` as an alias.

### Session storage still depends on personal-chat service behavior

The shared auth facade still delegates to personal-chat session code. In gateway mode, the session store requires Upstash Redis and gateway auth configuration.

This is acceptable for V1 because AI Chat is tied to the same user identity. Long term, auth should become its own feature or backend capability.

### Current catch-all API exports GET, POST, DELETE only

`src/app/api/[[...slugs]]/route.ts` currently exports:

```txt
GET
POST
DELETE
```

AI Chat can use those methods for V1. If we want PATCH for rename/update later, add `PATCH = handleApiRequest`.

### Streaming route shape needs care

Vercel AI SDK streaming can return a `Response`. Elysia can return responses, but streaming should be tested early with the exact route layer.

If Elysia passthrough causes friction, use a focused Next route for streaming:

```txt
src/app/api/ai/conversations/[conversationId]/stream/route.ts
```

and keep non-streaming CRUD under the existing catch-all Elysia API.

### Realtime infrastructure is not needed for AI Chat V1

Personal Chat uses Socket.IO/realtime session bootstrapping. AI Chat should not use that for v1. Streaming HTTP is enough.

### Private-room encryption boundary must stay explicit

AI Chat must not automatically read encrypted Private Room content or Personal Chat DMs. Any future "send to AI" workflow must be an explicit user action from visible client-side content.

## Packages

Install after implementation begins:

```bash
bun add ai @ai-sdk/google @ai-sdk/groq @openrouter/ai-sdk-provider
bun add drizzle-orm @neondatabase/serverless
bun add -D drizzle-kit
```

Optional if using Redis-backed request limits:

```bash
bun add @upstash/ratelimit
```

## Environment

```env
AI_CHAT_SERVICE_MODE=mock

NEON_DATABASE_URL=

AI_CHAT_DEFAULT_PROFILE=free
AI_CHAT_MAX_INPUT_CHARS=12000
AI_CHAT_MAX_HISTORY_MESSAGES=30
AI_CHAT_RATE_LIMIT_PER_MINUTE=10

GOOGLE_GENERATIVE_AI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=

AI_CHAT_FREE_PROVIDER=google
AI_CHAT_FREE_MODEL=gemini-2.5-flash-lite

AI_CHAT_FAST_PROVIDER=groq
AI_CHAT_FAST_MODEL=llama-3.1-8b-instant

AI_CHAT_BALANCED_PROVIDER=google
AI_CHAT_BALANCED_MODEL=gemini-2.5-flash
```

## Data Model

### `ai_conversations`

```txt
id
user_id
title
model_profile
model_provider
model_id
created_at
updated_at
deleted_at
```

### `ai_messages`

```txt
id
conversation_id
user_id
role
content
status
model_profile
model_provider
model_id
error_message
created_at
updated_at
```

Recommended role values:

```txt
user
assistant
system
```

Recommended status values:

```txt
pending
streaming
complete
failed
cancelled
```

### Optional later: `ai_usage_events`

```txt
id
user_id
conversation_id
message_id
provider
model_id
input_tokens
output_tokens
created_at
```

## Server Design

### Service Interface

```ts
interface AiChatService {
  getConversationSummaries(context): Promise<AiConversationSummary[]>
  createConversation(context, input): Promise<AiConversationSummary>
  getConversationDetail(context, conversationId): Promise<AiConversationDetail>
  renameConversation(context, input): Promise<AiConversationSummary>
  deleteConversation(context, conversationId): Promise<void>
  streamMessage(context, input): Promise<Response>
  retryAssistantMessage(context, input): Promise<Response>
}
```

### Implementations

- `mock-ai-chat-service.ts`
  - Deterministic local responses.
  - No API keys.
  - Useful for UI tests.
- `provider-ai-chat-service.ts`
  - Uses Vercel AI SDK.
  - Resolves Free/Fast/Balanced through a provider registry.
  - Persists user and assistant messages in Neon.
  - Stores the resolved profile/provider/model on each assistant message.

### Provider Registry

```ts
free -> google / gemini-2.5-flash-lite
fast -> groq / llama-3.1-8b-instant
balanced -> google / gemini-2.5-flash
```

The composer should show only profile labels. Assistant message metadata can show the profile label used for that response. Raw provider/model IDs stay server-side or in stored metadata unless needed for diagnostics.

## API Shape

Suggested endpoints:

```txt
GET    /api/ai/conversations
POST   /api/ai/conversations
GET    /api/ai/conversations/:conversationId
POST   /api/ai/conversations/:conversationId/rename
DELETE /api/ai/conversations/:conversationId
POST   /api/ai/conversations/:conversationId/messages/stream
POST   /api/ai/conversations/:conversationId/messages/retry
```

Use POST for rename in V1 unless PATCH is added to the catch-all route.

## Client Design

```txt
src/features/ai-chat/client/
  ai-inbox.tsx
  ai-conversation.tsx
  ai-conversation-header.tsx
  ai-conversation-composer.tsx
  ai-message-bubble.tsx
  ai-model-profile-menu.tsx
  hooks.ts
  ai-chat-api.ts
  query-keys.ts
```

Client behavior:

- `/ai` requires `requireAccountRouteSession("/ai")`.
- `/ai/chat/[conversationId]` requires `requireAccountRouteSession(...)`.
- New conversations default to the configured Free profile.
- Existing conversations remember a default/current profile for the composer.
- The selected profile can be changed before sending the next user message.
- The selected profile is captured at send time and stored on the assistant message generated for that turn.
- Older messages keep their original model metadata when the composer selection changes.
- Assistant messages display subtle model-profile metadata, for example in a footer or compact details area.
- Stop generation aborts the active stream.
- Stop generation leaves the partial assistant message visible as `cancelled`.
- Provider or stream failures leave the partial assistant message visible as `failed`.
- Retry reuses the last failed/cancelled assistant turn and records the model profile used by the retry.

## Development Steps

1. Finalize auth facade usage.
   - Done: account facade added.
   - Done: login success path now accepts `/ai`.
   - Deferred: update login page copy when login is unified.

2. Add database foundation.
   - Install Drizzle and Neon packages.
   - Add `drizzle.config.ts`.
   - Add `src/db/schema.ts`.
   - Add AI conversation/message tables.
   - Add migration scripts.

3. Add AI chat domain.
   - Models.
   - Zod schemas.
   - Message status and model profile types.

4. Add server config and provider registry.
   - Parse AI env vars.
   - Validate provider keys based on enabled profiles.
   - Add mock/provider service selection.
   - Done: server config parser added.
   - Done: provider registry added.
   - Done: `.env.example` documents AI chat provider settings.

5. Add AI chat storage layer.
   - Create/list/get/delete conversations.
   - Insert user messages.
   - Insert/update assistant messages.
   - Soft-delete by user ownership.
   - Done: DB mappers added.
   - Done: conversation storage operations added.
   - Done: message insert/update/read operations added.

6. Add non-streaming API routes.
   - Conversation list.
   - Create conversation.
   - Conversation detail.
   - Rename.
   - Delete.
   - Done: `/api/ai/conversations` list/create added.
   - Done: `/api/ai/conversations/:conversationId` detail/delete added.
   - Done: `/api/ai/conversations/:conversationId/rename` added.
   - Done: routes mounted in the catch-all API handler.

7. Add streaming route.
   - Use Vercel AI SDK.
   - Persist user message before streaming.
   - Resolve and persist the selected model profile for the assistant message.
   - Stream assistant text to client.
   - Save final assistant message.
   - Mark failed/cancelled when needed.
   - Done: `/api/ai/conversations/:conversationId/messages/stream` added.
   - Done: user and assistant messages are persisted around the stream.
   - Done: mock streaming mode added for local development.
   - Done: provider streaming uses Vercel AI SDK `streamText`.

8. Add AI chat UI.
   - Done: `/ai` route shell added.
   - Done: `/ai` placeholder page added.
   - Done: `/ai/chat/[conversationId]` placeholder page added.
   - Done: client API helpers added.
   - Done: React Query keys and hooks added.
   - Remaining: visual components and pages.
   - Inbox.
   - Conversation view.
   - Composer.
   - Model profile menu.
   - Copy/retry/stop controls.
   - Empty-state starter prompts.

9. Add home navigation.
   - Add AI card to `/`.
   - Update product options and copy.

10. Add tests.
   - Auth redirect path tests.
   - Provider registry tests.
   - Storage tests where practical.
   - Client rendering tests for model selector, per-message model metadata, cancelled/failed bubbles, and empty state.
   - Mock streaming/service tests.

11. Verify manually.
   - Login redirect from `/ai`.
   - Create AI conversation.
   - Stream response.
   - Stop and retry.
   - Delete thread.
   - Switch Free/Fast/Balanced.
   - Confirm previous assistant messages keep their original model metadata after switching.
   - Confirm cancelled/failed partial assistant messages remain visible after reload.

12. Add request limits.
   - Keep this as the final implementation step.
   - Decide storage at that point: simple DB-backed limits or Upstash Redis.
   - Preserve max input size enforcement regardless of the request-limit store.

## Open Questions

- Should `/personal/login` be renamed or aliased as `/login` before AI launch?
- Should AI Chat use the same top-level shell style as Personal Chat or get a distinct AI shell?
