# Personal Chat Mock-First Build Plan

## Summary
Build the personal-chat feature in a mock-first, drop-in-replaceable way by introducing a typed Elysia BFF layer, a mock realtime adapter, and a shared terminal-style UI system. The app entry route becomes the chooser, the existing privacy-chat flow moves under `/private`, and personal chat lives under `/personal/*` with session-aware routing.

## Key Changes

### 1. Route and app structure
- Move the existing privacy-chat home from `/` to `/private`.
- Move the existing privacy-chat room flow from `/room/[roomId]` to `/private/room/[roomId]` and update redirects, link generation, and proxy matching accordingly.
- Make `/` the new selection screen with two clear paths: private chat and personal chat.
- Add `/personal/login` for auth and `/personal` for the personal chat inbox.
- Add `/personal/chat/[conversationId]` for DM detail view.
- Add route guards so an authenticated user is redirected away from `/personal/login` to `/personal`, and an unauthenticated user is redirected from personal routes back to login.

### 2. BFF, mocks, and type safety
- Keep the BFF approach with Elysia inside Next API routes.
- Create a `PersonalChatService` adapter interface with two implementations:
  - `mock` implementation for local development and tests
  - `gateway` implementation for the real backend
- Frontend components and hooks depend only on the BFF/domain layer, never directly on mock data or raw backend responses.
- Generate transport types from [openapi.yaml](D:/Files/Projects/fullstack_microservice/docs/openapi.yaml) using OpenAPI type generation.
- Define internal domain types and zod-backed mappers for the UI layer so we separate transport shapes from frontend-friendly shapes.
- Add a mock realtime adapter that mirrors the Socket.IO contract from [socketio-appendix.md](D:/Files/Projects/fullstack_microservice/docs/socketio-appendix.md), including join/send/new-message flows.
- Plan the real realtime replacement around a BFF-issued socket bridge token/session so browser code does not need direct access to login tokens.
- Add BFF endpoints for:
  - session status
  - login/logout
  - DM candidates
  - conversation list
  - direct-conversation open/create
  - conversation detail and messages
  - realtime session bootstrap
  - privacy-room link generation

#### 2A. Incremental build sequence
Build this section in small slices so each change is reviewable and does not force us to commit to the full personal-chat feature at once.

##### Slice 2.1: BFF foundation and folder boundaries
- Goal: create the personal-chat backend-for-frontend skeleton without changing page behavior yet.
- Add a dedicated personal-chat area for:
  - BFF route registration
  - service interfaces
  - domain types
  - mapper/schemas
  - mock data sources
  - adapter selection
- Keep the existing `/api` Elysia entry, but split personal-chat concerns out of the current room/message route file so personal and private chat can evolve independently.
- Decide a clear module shape up front, for example:
  - `src/features/personal-chat/domain/*`
  - `src/features/personal-chat/server/*`
  - `src/features/personal-chat/mocks/*`
- Deliverable:
  - empty-but-wired personal-chat BFF module mounted under `/api/personal/*`
  - no page integration yet
- Review focus:
  - naming
  - folder structure
  - dependency direction
  - whether the interface boundaries feel right before we add behavior

##### Slice 2.2: Domain types first, transport types deferred behind a boundary
- Goal: lock the frontend-friendly models before wiring real payloads.
- Add the minimum internal domain models:
  - `SessionUser`
  - `PersonalSession`
  - `DmCandidate`
  - `ConversationSummary`
  - `ConversationDetail`
  - `ChatMessage`
  - `PrivacyLinkMessage`
  - `RealtimeConnectionState`
- Add zod schemas for the domain shapes where runtime validation matters.
- Introduce a transport folder or namespace now, even if generated types are temporarily stubbed until codegen is wired.
- Deliverable:
  - typed domain contracts the UI can safely build against
  - a clear distinction between transport types and domain types
- Review focus:
  - field names
  - nullable/optional decisions
  - whether the models are ergonomic for React components and query caches

##### Slice 2.3: `PersonalChatService` interface and mock adapter
- Goal: define the app-facing contract once, then make the mock implementation satisfy it.
- Add `PersonalChatService` methods for the first read path only:
  - `getSession`
  - `getDmCandidates`
  - `getConversationSummaries`
  - `getConversationDetail`
- Implement a mock adapter backed by static in-memory fixtures.
- Keep browser code unaware of where data comes from.
- Deliverable:
  - a fully typed mock service that returns domain models only
  - no direct mock imports inside pages/components
- Review focus:
  - interface completeness
  - whether the method signatures are stable enough for later gateway replacement
  - whether the mock data shape feels realistic enough

##### Slice 2.4: First BFF endpoints backed by mocks
- Goal: expose the mock adapter through Elysia so the frontend stops depending on local fixture imports.
- Add the first read-only BFF endpoints:
  - `GET /api/personal/session`
  - `GET /api/personal/dm-candidates`
  - `GET /api/personal/conversations`
  - `GET /api/personal/conversations/:conversationId`
- Validate outbound responses with zod-backed serializers where useful.
- Deliverable:
  - browser clients can fetch personal-chat data only through the BFF
  - current pages can be wired progressively without touching the adapter internals
- Review focus:
  - endpoint names
  - response envelopes
  - error handling defaults
  - whether the API is pleasant to consume from React Query

##### Slice 2.5: Client API layer and typed query hooks
- Goal: add a thin frontend integration layer between components and the BFF.
- Add:
  - a personal-chat client module
  - query key helpers
  - read-only query hooks for session, candidates, conversation list, and conversation detail
- Keep components consuming domain models from hooks, not raw fetch responses.
- Deliverable:
  - pages can start rendering real mock-backed data without knowing about Elysia route details
- Review focus:
  - hook naming
  - query-key stability
  - loading/error shape
  - whether this abstraction is thin enough

##### Slice 2.6: OpenAPI codegen wiring
- Goal: bring in generated transport types before the real gateway adapter exists.
- Add an explicit codegen step that generates types from `openapi.yaml`.
- Store generated output in a dedicated generated folder and never mix it with hand-written domain models.
- Do not switch pages or hooks to transport types.
- Deliverable:
  - generated backend payload types available to the server/gateway layer
  - a documented regeneration command
- Review focus:
  - tool choice
  - generated file location
  - how much of the generated surface we actually import

##### Slice 2.7: Transport-to-domain mappers
- Goal: create the seam that protects the UI from backend payload churn.
- Add mapper functions that convert generated transport shapes into domain models.
- Back each mapper with zod validation where the backend contract is loose or hard to trust.
- Use these mappers first in tests and mock parity checks, even if the gateway adapter is not wired yet.
- Deliverable:
  - a reusable mapper layer ready for the real adapter
  - tests that confirm our domain contracts match expected backend payloads
- Review focus:
  - lossless vs opinionated mapping decisions
  - date/time normalization
  - message union handling
  - fallback behavior on bad payloads

##### Slice 2.8: Write-path service methods and BFF endpoints
- Goal: add mutation capabilities after the read path feels stable.
- Extend `PersonalChatService` with:
  - `login`
  - `logout`
  - `openOrCreateDirectConversation`
  - `sendMessage`
  - `createPrivacyRoomLink`
  - `createRealtimeSession`
- Add matching BFF endpoints, still powered by mocks first.
- Deliverable:
  - enough API surface to support the personal login, DM opening, composer, and privacy-link flows
- Review focus:
  - mutation payload shape
  - idempotency expectations
  - session-cookie responsibilities
  - optimistic update compatibility

##### Slice 2.9: Mock realtime adapter
- Goal: prove the event contract before touching real sockets.
- Add a `RealtimeAdapter` interface with a mock implementation that simulates:
  - connect
  - join conversation
  - leave conversation
  - send message
  - receive `new-message`
  - ack/reconcile with `clientMessageId`
- Mirror the eventual Socket.IO event names and payload shapes as closely as practical.
- Deliverable:
  - a local realtime layer that can drive optimistic UI and message reconciliation
- Review focus:
  - event naming
  - lifecycle cleanup
  - whether the mock contract is realistic enough for later replacement

##### Slice 2.10: Gateway adapter and real realtime bridge planning
- Goal: make the mock implementation replaceable rather than permanent.
- Add a `gateway` adapter that consumes generated transport types and mapper functions.
- Keep gateway selection behind server-side configuration so browser code still talks only to the BFF.
- Add the realtime bootstrap shape for a future BFF-issued bridge token/session, even if the full socket bridge is not turned on in the same change.
- Deliverable:
  - mock and gateway adapters both satisfy the same contracts
  - swapping implementations does not require page-level rewrites
- Review focus:
  - parity between mock and gateway
  - config strategy
  - auth/token containment

#### 2B. Suggested review checkpoints
- Checkpoint 1:
  - slices `2.1` to `2.4`
  - outcome: BFF skeleton, domain models, mock service, read-only endpoints
- Checkpoint 2:
  - slice `2.5`
  - outcome: typed client hooks hooked to the BFF
- Checkpoint 3:
  - slices `2.6` to `2.7`
  - outcome: codegen and mapper seam in place before real backend wiring
- Checkpoint 4:
  - slice `2.8`
  - outcome: write-path endpoints and service methods
- Checkpoint 5:
  - slice `2.9`
  - outcome: mock realtime contract working end-to-end
- Checkpoint 6:
  - slice `2.10`
  - outcome: real gateway adapter drops in behind the same interfaces

#### 2C. Recommended implementation order for us
- First change:
  - slices `2.1` and `2.2`
  - reason: this gives us the folder layout and the type language before any behavior calcifies
- Second change:
  - slice `2.3`
  - reason: once the interface exists, the mock adapter becomes the reference implementation
- Third change:
  - slice `2.4`
  - reason: this makes the BFF real and reviewable without pulling in frontend wiring yet
- Fourth change:
  - slice `2.5`
  - reason: only after the endpoint shapes feel right should the pages/hooks consume them

### 3. Auth and state model
- Keep BFF-managed session cookies as the only auth mechanism for personal chat.
- Treat `GET /api/personal/session` as the single source of truth for auth state.
- Do not store backend auth tokens in `localStorage`, React Query cache, or Zustand.
- Use React Query for all server state:
  - session
  - DM candidates
  - conversation summaries
  - conversation detail/messages
  - mutation results (`open/create DM`, `send message`, `privacy room link`, `realtime bootstrap`)
- Use a minimal Zustand store only for UI-local state:
  - active mobile drawer/nav state
  - per-conversation composer drafts
  - transient composer UI flags
- Do not store server entities, auth booleans, or message history in Zustand.

#### 3.0. Step 3 preflight / readiness gate
- Treat the current `/personal/login`, `/personal`, and `/personal/chat/[conversationId]` routes as scaffolds only.
- Before wiring the real inbox and DM flows, land a small preflight change that locks the Step 3 seams:
  - add the React test stack from the test plan:
    - `vitest`
    - `@testing-library/react`
    - `@testing-library/jest-dom`
    - `jsdom`
  - add a dedicated `typecheck` script so Step 3 can require lint + typecheck + focused tests
  - add shared auth/redirect guard helpers for personal routes before page-level integration so server-first and client-fallback behavior stay uniform
  - extend the client integration layer with mutation API wrappers and typed mutation hooks for:
    - `login`
    - `logout`
    - `openOrCreateDirectConversation`
    - `sendMessage`
    - `createPrivacyRoomLink`
    - `createRealtimeSession`
  - add a shared optimistic message merge/reconciliation helper keyed by `message.id` and `clientMessageId` before the DM page consumes realtime events, so the mock realtime flow cannot double-append outbound messages
- Outcome:
  - Step 3 starts from stable guard, mutation, and test boundaries rather than mixing those concerns into the first inbox/DM UI change

#### 3A. Route guard contract
- `/personal/login`:
  - if authenticated, redirect to `/personal`
- `/personal` and `/personal/chat/[conversationId]`:
  - if unauthenticated, redirect to `/personal/login?next=<encoded-target>`
- Guard strategy:
  - server-first redirect in route entrypoints/layouts
  - client fallback guard for transitions and stale sessions
- Add a shared guard helper for protected personal routes so behavior is uniform.

#### 3B. Mutation and cache policy
- `login`:
  - set session cookie through BFF response
  - invalidate `session`, `dm-candidates`, and `conversations`
- `logout`:
  - clear session cookie through BFF response
  - clear/invalidate personal-chat query caches and route to `/personal/login`
- `openOrCreateDirectConversation`:
  - update conversation list cache with returned summary
  - navigate to `/personal/chat/[conversationId]`
- `sendMessage`:
  - optimistic append using `clientMessageId` with `deliveryStatus: "pending"`
  - reconcile pending message on ack/new event to `deliveryStatus: "sent"`
  - convert to `deliveryStatus: "failed"` on error event/response
- `createPrivacyRoomLink`:
  - follow the same optimistic/reconcile flow as `sendMessage`
  - render as `privacy-link` message union variant

#### 3C. Realtime lifecycle and dedupe rules
- Connect realtime only after:
  - authenticated session exists
  - `POST /api/personal/realtime/session` succeeds
- Join conversation room on DM page mount.
- Leave room and cleanup listeners on DM page unmount or conversation switch.
- Reconnect policy:
  - transition connection state through `connecting -> connected`
  - expose `reconnecting` and `error` states to UI
- Dedupe incoming and optimistic messages by:
  - `message.id` when present
  - fallback to `clientMessageId` during reconciliation

#### 3D. Error model
- `401`:
  - treat as expired/invalid session
  - redirect to `/personal/login?next=<current-path>`
- `404` conversation:
  - show conversation-not-found empty/error state with return action to inbox
- `400` validation/bad request:
  - show inline composer/banner error and keep draft intact
- network/realtime disconnect:
  - show non-blocking connection state badge and retry action

#### 3E. Acceptance criteria for Step 3
- Personal routes enforce the guard contract on hard refresh and in-app navigation.
- Session state is driven only by session query + cookie-backed BFF.
- Inbox and DM pages consume personal-chat hooks/domain models only.
- Optimistic send + reconcile works with `clientMessageId`.
- Realtime join/leave cleanup prevents duplicate listeners/events.
- Lint and typecheck pass, and Step 3 includes focused tests for:
  - route guard behavior
  - mutation cache updates
  - optimistic message reconciliation

### 4. UI system and page build order
- First create shared terminal-style tokens in global theme:
  - neon green accent
  - dark terminal surfaces
  - mono + expressive heading fonts
  - reusable spacing, borders, panel, and status styles
- Centralize static copy in a dedicated `src/copy/` area rather than a generic constants file.
- Build reusable primitives before page assembly:
  - top app bar
  - side nav
  - profile card
  - avatar and placeholder avatar
  - section label
  - chat history row
  - DM candidate chip/card
  - message bubble
  - composer
  - privacy-link message card
  - empty/loading/error states
- Implement pages in this order:
  1. `/private` migration and route cleanup
  2. `/` selection screen
  3. `/personal/login`
  4. `/personal` inbox/history
  5. `/personal/chat/[conversationId]`
- Follow the same loop for each page: theme/primitives, static layout, mock data wiring, responsive/mobile polish, tests.

### 5. Personal chat behavior
- Inbox page:
  - top horizontal list of DM candidates from `/users/dm-candidates`
  - below that, conversation history from `/conversations`
  - each row shows avatar placeholder, display name, last message preview, and timestamp
  - nav shows `Messages` active; `Secure Vault`, `Terminals`, and `Settings` are present as non-functional placeholders in v1
- DM page:
  - load messages via BFF and join the conversation’s realtime channel
  - continue existing conversations and open/create direct conversations from the candidate strip
  - support a privacy-chat handoff action that generates a private-room link and inserts a special share card/message into the DM thread
  - smooth scrolling:
    - auto-scroll to bottom on initial load
    - auto-scroll on new outbound/inbound messages only if the user is already near the bottom
    - preserve scroll position when older history is introduced later
- Profile section:
  - show the profile block and upload affordance in the UI now
  - keep image upload non-functional in v1 until backend support exists

### 6. Mobile support and UX constraints
- All new screens must have dedicated mobile layouts, not just desktop shrink-downs.
- Use sticky headers/composers, safe-area padding, and horizontally scrollable DM candidates.
- Keep the terminal design language but simplify interaction density on mobile.
- Preserve clarity over ornament: strong hierarchy, obvious CTAs, minimal motion, no confusing hidden actions.

### 7. Suggested v1 extras
- Add unread indicators in the conversation list.
- Add a connection status badge for mock/online/reconnecting state.
- Add quick “new secure room” action in the DM composer/header.
- Keep these in scope only if they do not delay the core route/auth/message flow.

## Public Interfaces and Types
- Generated transport types from the backend OpenAPI spec become the source of truth for backend payloads.
- Internal frontend/domain models should include at minimum:
  - `SessionUser`
  - `PersonalSession`
  - `DmCandidate`
  - `ConversationSummary`
  - `ConversationDetail`
  - `ChatMessage`
  - `PrivacyLinkMessage`
  - `RealtimeConnectionState`
- Adapter interfaces should include:
  - `PersonalChatService`
  - `RealtimeAdapter`
  - optional `AuthSessionProvider` if auth/session bootstrapping needs separate composition
- Static copy should live in a named content module such as `src/copy/personal-chat.ts`.

## Test Plan
- Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, and any small utilities required for React/Next component testing.
- Add a `typecheck` script and make `lint` + `typecheck` part of the Step 3 acceptance bar.
- Unit tests:
  - transport-to-domain mappers
  - auth/session redirect logic
  - mock service adapters
  - privacy-room link generation
  - message merge/reconciliation logic for optimistic sends
  - scroll behavior helpers
- Component tests:
  - selection screen routes correctly
  - login screen redirects when session exists
  - inbox renders candidates and chat rows from mock data
  - clicking a candidate opens or creates the expected DM
  - DM view renders history and appends optimistic/new messages correctly
  - privacy-link card renders and navigates to the private room
- Acceptance checks:
  - the app works fully against mocks without the real backend
  - swapping from mock adapter to real gateway adapter does not require page-level rewrites
  - layouts remain usable on mobile and desktop
  - current privacy chat still works after being moved under `/private`

## Assumptions and Defaults
- Default auth model: BFF cookie-based session.
- Default realtime model for v1: mock realtime adapter first, real Socket.IO later through a BFF bridge token/session.
- Default route move: current privacy chat namespace becomes `/private`.
- Default text organization: use `src/copy/` instead of a generic constants bucket.
- Default nav scope for v1: only `Messages` is functional; the other nav items are present but placeholder-only.
- Default profile-image scope for v1: UI scaffold only, no upload integration yet because the current backend contract does not expose avatar fields or upload endpoints.
