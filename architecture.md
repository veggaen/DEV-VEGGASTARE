# Architecture — Veggat Platform

> System architecture, data flow, and technical design decisions.

---

## System Overview

Veggat is a **two-service architecture**:

1. **Frontend** (Next.js 16) — Full-stack web app handling UI, auth, database operations, and API routes
2. **Backend** (Hapi.js) — Integration Core handling shipping, real-time broadcasting, and third-party connectors

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│  Browser (React 19)  ·  Web3 Wallets  ·  Mobile (future)    │
└───────────┬──────────────────┬──────────────────┬────────────┘
            │ HTTPS            │ WSS              │ WalletConnect
            ▼                  ▼                  ▼
┌───────────────────┐  ┌──────────────┐  ┌──────────────────┐
│   Vercel Edge     │  │  Pusher      │  │  Reown Cloud     │
│   (CDN + SSR)     │  │  (Events)    │  │  (Relay)         │
└───────┬───────────┘  └──────┬───────┘  └──────────────────┘
        │                     │
        ▼                     │
┌───────────────────────────────────────────────────────────┐
│                    FRONTEND SERVICE                        │
│  Next.js 16 · React 19 · App Router · Server Actions      │
│                                                            │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Auth    │ │ API      │ │ Server   │ │ Prisma       │  │
│  │ (NextAu │ │ Routes   │ │ Actions  │ │ Client       │  │
│  │ th v5)  │ │ (/api/*) │ │          │ │ (v7.3)       │  │
│  └─────────┘ └──────────┘ └──────────┘ └──────┬───────┘  │
│                                                │           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐       │           │
│  │ Pusher   │ │ EdgeStor │ │ wagmi /  │       │           │
│  │ Client   │ │ e Client │ │ Reown    │       │           │
│  └──────────┘ └──────────┘ └──────────┘       │           │
└───────────────────────────────────────────────┼───────────┘
                                                │
                    ┌───────────────────────┐    │
                    │    PostgreSQL          │◄───┘
                    │    (Neon / Supabase)   │◄───┐
                    └───────────────────────┘    │
                                                │
┌───────────────────────────────────────────────┼───────────┐
│                   BACKEND SERVICE              │           │
│  Hapi.js 21 · Port 3001 (HTTP) + 3002 (WS)   │           │
│                                                │           │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │           │
│  │ Bring    │ │ Socket   │ │ Prisma       │──┘           │
│  │ Shipping │ │ .IO      │ │ Client       │              │
│  │ Provider │ │ Server   │ │ (v6.16)      │              │
│  └──────────┘ └──────────┘ └──────────────┘              │
│                                                           │
│  ┌──────────┐ ┌──────────┐                               │
│  │ Pusher   │ │ Zod      │      Deployed on Railway      │
│  │ Server   │ │ Validati │                               │
│  └──────────┘ └──────────┘                               │
└───────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Page Load (SSR)

```
Browser → Vercel Edge → Next.js Server Component → Prisma → PostgreSQL
       ← HTML + RSC payload ←
```

### 2. Server Action (Mutation)

```
Browser (form submit) → Server Action → Prisma → PostgreSQL
                       → revalidatePath/redirect
```

### 3. Shipping Rate Lookup

```
Frontend → fetch('/v1/shipping/rates') → Backend (Hapi)
                                        → Bring API (live) / Mock provider
                                        ← Rate options ←
```

### 4. Real-Time Warehouse Sync

```
Backend → Prisma update → PostgreSQL
       → Socket.IO broadcast → Connected frontends
       → Pusher trigger → All subscribed clients
```

### 5. P2P Crypto Trade

```
User A opens trade → Pusher channel created
User B joins      → Pusher subscription
Offer/counter     → Server action → Prisma → Pusher event
Accept            → wagmi wallet signature → On-chain verification
                  → Server action confirms → Pusher "trade:complete"
```

### 6. Pulse Feed Event

```
User creates post → Server action → Prisma insert
                  → Pusher trigger("pulse:new-post")
All feed clients  ← Pusher subscription ← real-time update
```

### 7. AI Quiz Generation (Streaming)

```
PollBuilder          → POST /api/polls/generate-stream (topic, difficulty, mode)
                     ← SSE stream (TransformStream + WritableStreamDefaultWriter)

Key resolution (mode: "auto"):
  1. Check saved key  → found? use it (unlimited, no quota)
  2. No saved key     → fall back to platform key (5/day quota)
  mode: "one_time"   → use provided BYOK key (unlimited)

Security:
  → sanitizeUserPrompt() blocks prompt injection patterns
  → output content validation blocks unsafe responses

Streaming steps:
  ← step 1: "Researching topic…"       (progress event)
  ← step 2: "Verifying facts…"          (progress event)
  ← step 3: "Constructing questions…"    (progress event)
  ← step 4: "Building explanations…"     (progress event)
  ← step 5: "Validating quiz…"           (progress event)
  ← step 6: "Calculating trust score…"   (progress event)
  ← final:  { step: "result", data: pollJSON, _meta: { freeUsed, freeLimit, usedSavedKey } }

Providers: OpenAI | Anthropic (Claude) | OpenRouter | Grok (xAI)
Daily quota guard: 5 generations/user/day for platform-key users (BYOK unlimited).
Trust note appended to poll description when trust ≤ medium.
```

---

## Service Responsibilities

### Frontend Owns

| Concern | Implementation |
|---------|---------------|
| **Authentication** | NextAuth v5 with multiple OAuth providers + email |
| **Authorization** | Middleware-based route protection, role checks in server actions |
| **Database (primary)** | Prisma 7.3.0 with PostgreSQL via `@prisma/adapter-pg` |
| **UI Rendering** | React 19 Server Components + Client Components |
| **File Uploads** | EdgeStore (images, avatars, attachments) |
| **Web3 Wallet** | Reown AppKit + wagmi + Solana adapters |
| **API Routes** | `/api/*` for auth callbacks, uploads, webhooks |
| **Server Actions** | All CRUD operations on products, companies, users, polls |

### Backend Owns

| Concern | Implementation |
|---------|---------------|
| **Shipping Integration** | Bring API (rates, tracking, postal codes) with mock fallback |
| **WebSocket Server** | Socket.IO on port 3002 for warehouse real-time sync |
| **Event Broadcasting** | Pusher server-side triggers |
| **Versioned API** | `/v1/*` stable interface for third-party integration |
| **Input Validation** | Zod schemas for all route payloads |

### Shared

| Concern | Details |
|---------|---------|
| **PostgreSQL** | Both services can connect (frontend is primary, backend for warehouse ops) |
| **Pusher** | Backend triggers events, frontend subscribes |
| **TypeScript** | Both codebases are fully typed |

---

## Database Architecture

### ORM: Prisma

- **Frontend:** Prisma 7.3.0 with `@prisma/adapter-pg` driver adapter
- **Backend:** Prisma 6.16.3 (standard client)
- **Schema location:** `frontend/prisma/schema.prisma` (2000+ lines, canonical source)
- **Backend schema:** `backend/prisma/schema.prisma` (subset for warehouse operations)

### Key Model Groups

```
Users & Auth
├── User, Account, Session, VerificationToken
├── TwoFactorToken, TwoFactorConfirmation
└── PasswordResetToken

Commerce
├── Product, Category, ProductImage
├── Company, Employee (roles: OWNER/ADMIN/MEMBER)
├── Warehouse, WarehouseInventory
├── Cart, CartItem, Order, OrderItem
└── ShippingAddress

Social
├── Conversation, Message, ConversationParticipant
├── Follow, Friendship, FriendRequest
├── Post, Comment, Reaction
└── Notification

Polls
├── AdvancedPoll, PollQuestion, PollQuestionOption
├── PollResponse, PollAnswer, PollAnswerImage
└── PollTemplate

Web3
├── (Verification tier stored on User model)
└── (Trade records in Conversation/Message system)
```

---

## Authentication Architecture

```
NextAuth v5 (Auth.js)
├── Providers
│   ├── Google OAuth
│   ├── GitHub OAuth
│   ├── Discord OAuth
│   └── Email (magic link / credentials)
├── Adapter: Prisma (User, Account, Session tables)
├── Strategy: JWT (stateless sessions)
├── Middleware: auth-edge.config.ts (Edge Runtime)
└── Callbacks: session, jwt, signIn
```

### Verification Tier System

Users progress through 12 verification tiers that affect their view strength and poll power:

| Multiplier Range | Tiers |
|-----------------|-------|
| 0.10x – 0.45x | Anonymous → Web3 Basic |
| 0.50x – 0.75x | Social Basic → Multi-Social |
| 0.85x – 0.95x | Web2 Payment → Payment Verified |
| 1.00x – 1.20x | Phone Verified → Fully Verified |

---

## Real-Time Architecture

### Pusher (Primary)

Used for most real-time features:

| Channel Pattern | Events | Feature |
|----------------|--------|---------|
| `pulse-feed` | `new-post`, `reaction` | Social feed |
| `trade-{id}` | `offer`, `accept`, `decline` | P2P trading |
| `notifications-{userId}` | `new-notification` | User notifications |
| `warehouse-{id}` | `stock-update` | Inventory changes |

### Socket.IO (Secondary)

Used specifically for warehouse real-time sync:
- Server on backend port 3002
- Bidirectional communication for stock updates
- Broadcasts to all connected warehouse viewers

---

## Web3 Architecture

```
Reown AppKit (WalletConnect v2)
├── wagmi (React hooks for Ethereum)
│   ├── useAccount, useConnect, useDisconnect
│   ├── useSignMessage (verification)
│   └── useSendTransaction (trade confirmation)
├── Solana Wallet Adapters
│   ├── Phantom
│   └── Solflare
└── Coinbase Wallet SDK
```

### Trade Flow

1. Trade window opens (parallel route `@modal/(.)trade/[id]`)
2. Items placed in offer slots (OSRS-style grid)
3. Both parties confirm offers via Pusher
4. Accept triggers `useSignMessage` for wallet verification
5. Server action records trade, broadcasts completion

---

## Deployment Architecture

```
Production
├── Frontend: Vercel
│   ├── Edge Runtime (auth middleware)
│   ├── Serverless Functions (API routes, server actions)
│   ├── Static Assets (CDN)
│   └── ISR / SSR pages
├── Backend: Railway
│   ├── Dockerfile-based deployment
│   ├── HTTP on assigned port
│   └── WebSocket on separate port
└── Database: PostgreSQL (Neon / Supabase / Railway)

Development
├── Frontend: localhost:3000 (next dev --webpack)
├── Backend: localhost:3001 (HTTP) + :3002 (WS)
└── Database: Local PostgreSQL or remote dev instance
```

---

## Security Considerations

- **CORS:** Backend restricts origins in production (`CORS_ORIGINS` env var)
- **Input Validation:** Zod schemas on all server actions and backend routes
- **Auth Middleware:** Edge-based route protection before page load
- **Rate Limiting:** Verification tier weighting + burst detection for anti-gaming
- **Web3 Signing:** Wallet signature required for trade acceptance
- **CSRF:** NextAuth built-in CSRF protection
- **Environment Isolation:** Separate Reown projects, DB instances, and Pusher apps for dev/prod

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Two-service split** | Backend stays framework-agnostic; frontend can be swapped without losing shipping/WS logic |
| **Prisma on both services** | Frontend needs full schema access; backend only needs warehouse subset |
| **Pusher over pure Socket.IO** | Pusher handles scaling, presence, and auth; Socket.IO used only where bidirectional is needed |
| **App Router (not Pages)** | Server Components reduce client bundle; parallel routes enable modal patterns |
| **Reown over raw ethers** | AppKit provides modal UI, multi-chain, and WalletConnect v2 relay out of the box |
| **EdgeStore over S3** | Simpler API, built-in React hooks, no AWS configuration needed |
| **12-tier verification** | Granular trust scoring enables fair poll weighting and anti-gaming |

---

*See also: [docs/integration-core.md](docs/integration-core.md) for the original Integration Core architecture recommendation.*
