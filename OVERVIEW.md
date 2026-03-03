# Frontend Chat - Project Overview

## What this project is
`frontend_chat` is a private, temporary chat application built with Next.js App Router. Rooms are short-lived, support up to 2 participants, and messages are encrypted on the client before being stored.

## Tech stack
- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS v4
- TanStack React Query
- Elysia (route layer inside Next API handlers)
- Eden Treaty (typed API client)
- Upstash Redis (room/message state)
- Upstash Realtime (live events)
- Web Crypto API (AES-GCM encryption/decryption)

## High-level architecture
- **UI layer**: `src/app/page.tsx` (lobby) and `src/app/room/[roomId]/page.tsx` (chat room).
- **Provider layer**: React Query + Realtime provider in `src/components/providers.tsx`.
- **API layer**: Elysia app under `src/app/api/[[...slugs]]/route.ts` exposes room/message endpoints.
- **Auth/room guard**:
  - `src/proxy.ts` checks room validity and capacity.
  - Issues `x-auth-token` cookie for room-scoped access.
  - `src/app/api/[[...slugs]]/auth.ts` validates token + room membership.
- **Data layer**: Redis keys store room metadata and message history with TTL.
- **Realtime layer**: Upstash Realtime emits `chat.message` and `chat.destroy`.
- **Crypto layer**: `src/lib/encryption.ts` generates a 256-bit key in browser and performs AES-GCM encryption/decryption.

## End-to-end flow
1. User opens lobby and creates a room.
2. Server creates `meta:<roomId>` in Redis with TTL (10 minutes).
3. Client navigates to `/room/<roomId>#<key>` where `<key>` is generated locally.
4. Middleware validates room, enforces max-2 participants, sets auth cookie if needed.
5. Sender encrypts plaintext in browser and posts ciphertext to `/api/messages`.
6. Server stores ciphertext, emits realtime message event.
7. Clients receive event, refetch message list, decrypt locally using URL hash key.
8. On TTL expiry or manual destroy, server emits `chat.destroy` and removes room data.

## Security model
- Encryption key is in URL hash (`#...`), which is not sent in HTTP requests.
- Server stores encrypted message text only (assuming encrypt path succeeds).
- Room access is cookie-token based, scoped to room membership list in Redis.
- Rooms are ephemeral due to Redis TTL.

## Current strengths
- Clean separation between UI, transport, realtime, and crypto utilities.
- Typed API contract (`App` type + Eden client).
- Simple ephemeral-room model with explicit destroy operation.
- Live updates and room-destroy broadcast behavior are implemented.

## Improvement opportunities
1. **Fix Redis key consistency**
   - Message keys use `message:<roomId>` in some places and `messages:<roomId>`/`history:<roomId>` in others.
   - Standardize key names to avoid orphaned data and partial cleanup.

2. **Fail closed on encryption errors**
   - `encrypt()` currently returns plaintext on error.
   - Instead, throw and block send to prevent accidental unencrypted storage.

3. **Remove sensitive debug logs**
   - Remove logs printing key/cipher details and runtime debug noise in production paths.

4. **Harden auth error handling**
   - Missing token/room should produce a controlled 401 response, not a generic error path.

5. **Use environment-aware API client base URL**
   - `treaty("localhost:3000")` is brittle for deployment.
   - Prefer relative URL or runtime-configured origin.

6. **Add tests**
   - Unit: encryption utility behavior.
   - API: room lifecycle, auth middleware, TTL behavior.
   - Integration: create room -> chat -> destroy flow.

7. **Production readiness hygiene**
   - Expand README with env setup and deployment steps.
   - Add CI for `lint` + type-check + tests.

## Suggested folder ownership map
- `src/app/**`: page/UI composition
- `src/app/api/**`: route definitions and request handling
- `src/lib/**`: infrastructure (redis, realtime, crypto, API client)
- `src/hooks/**`: client-only user/session helpers
- `src/proxy.ts`: route guarding and room entry policy

---
This document reflects the repository state reviewed on **March 3, 2026**.
