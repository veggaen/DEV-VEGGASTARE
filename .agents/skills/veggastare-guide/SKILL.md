---
name: veggastare-guide
description: "Guide for working with VeggaStare (Freedom Store™) — a full-stack TypeScript marketplace with AI chat, live polls, crypto trading, and social features. Use when navigating the codebase, adding features, fixing bugs, or understanding architecture. Triggers on: veggastare, veggat, freedom store, marketplace, poll builder, BYOK, True Reach, pulse feed."
---

# VeggaStare / Freedom Store™ — Agent Guide

> **What:** Full-stack Web3-enabled marketplace + social platform in TypeScript.
> **Domain:** veggat.com | **Codebase:** DEV-VEGGASTARE | **Owner:** v3gga

---

## Quick Orientation

Two services, one PostgreSQL database:

| Service | Stack | Port | Deployed To |
|---------|-------|------|-------------|
| **Frontend** | Next.js 16, React 19, Tailwind, Prisma 7 | 3000 | Vercel |
| **Backend** | Hapi.js 21, Socket.IO, Prisma 7 | 3001 (HTTP) + 3002 (WS) | Railway |

Frontend is the primary service — auth, DB writes, API routes, server actions, UI.
Backend is the "Integration Core" — shipping, warehouse sync, third-party connectors.

---

## Critical Rules

Violating these causes bugs. Always check first.

1. **Auth is server-side only.** Never import `auth()` in client components.
2. **Prisma Client is generated, never committed.** Run `npx prisma generate` after schema changes.
3. **`frontend/prisma/schema.prisma` is canonical.** 77 models, 39 enums, ~2500 lines.
4. **All mutations use Zod-validated server actions** in `frontend/actions/`.
5. **Webpack mode only.** Use `next dev --webpack` and `next build --webpack` (not Turbopack).
6. **Never push to `main` directly.** Flow: `feature → dev → verify → main`.
7. **Vercel does NOT run migrations.** After schema changes to prod, manually run `npx prisma db push` with production `DATABASE_URL`.
8. **Web3 trades require wallet signature** (`useSignMessage`) before confirmation.
9. **`GATE_PASSWORD` via env var only.** No hardcoded fallback.

---

## Codebase Map

```
DEV-VEGGASTARE/
├── frontend/                    # PRIMARY — Next.js 16 App Router
│   ├── app/                     # Pages & API routes (~265 files)
│   │   ├── api/                 # ~120+ API routes
│   │   │   ├── ai-chat/        # AI chat streaming endpoint (SSE)
│   │   │   ├── polls/           # Poll CRUD + AI generation
│   │   │   └── ...
│   │   ├── feed/, pulse/        # Social feed (Pulse)
│   │   ├── products/            # Marketplace product pages
│   │   ├── poll-test/           # Poll builder page
│   │   ├── ai/                  # Full AI chat page
│   │   └── (protected)/         # Auth-gated routes
│   ├── actions/                 # Server actions (~30 files, Zod-validated)
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives
│   │   └── uicustom/           # Custom composites
│   │       ├── home/            # Landing page (hero, chat widget, sections)
│   │       ├── polls/           # PollBuilder, PollTaker, AI generation
│   │       └── crypto-related/  # Wallet UI, trade windows, inventory
│   ├── lib/                     # Utilities (rate-limit, fuzzy-match, ai-key-*)
│   ├── prisma/schema.prisma     # Canonical DB schema
│   ├── schemas/                 # Zod validation schemas
│   └── hooks/                   # Custom React hooks
│
├── backend/                     # INTEGRATION CORE — Hapi.js 21
│   ├── src/
│   │   ├── index.ts             # Server bootstrap
│   │   ├── routes.ts            # /v1/* endpoints
│   │   ├── websocket.ts         # Socket.IO (warehouse sync)
│   │   └── integrations/        # Bring/Posten shipping (mock + live)
│   └── openapi/v1.yaml          # API docs
│
├── agent.md                     # Full project onboarding for AI agents
├── MasterContext.md              # Living invariants & module map
├── architecture.md               # System design & data flows
└── prd.md                       # Product requirements & roadmap
```

---

## Key Feature Areas

### 1. AI Chat System

**Files:** `app/api/ai-chat/route.ts`, `app/ai/`, `components/uicustom/home/LandingChatWidget.tsx`

- 6 providers: OpenAI, Anthropic, Google Gemini, Groq, Grok, OpenRouter
- SSE streaming with `data: {text}` format, terminated by `data: [DONE]`
- **BYOK (Bring Your Own Key):** Keys encrypted with AES-256-GCM, stored in `UserAiApiKey` table
- Key resolution: inline one-time key → saved BYOK key → platform key → BYOK_REQUIRED error
- Key auto-detection from prefix: `gsk_`→Groq, `sk-or-`→OpenRouter, `sk-ant-`→Anthropic, `xai-`→Grok, `AIza`→Google, `sk-`→OpenAI
- Crypto files: `lib/ai-key-crypto.ts` (encrypt/decrypt), `lib/ai-key-store.ts` (CRUD for keys)
- Anonymous users: free Gemini only (rate-limited). Authenticated: all 6 providers.
- Daily quota: 5 free AI generations/day via PostgreSQL tracking

### 2. Polls & Quizzes

**Files:** `app/poll-test/`, `components/uicustom/polls/`, `app/api/polls/`

- 3 types: SURVEY, FEEDBACK, QUIZ
- 11 question types: SINGLE_CHOICE, MULTI_CHOICE, SLIDER, SCALE, TEXT, RANKING, SHAPE_MATCH, UI_ARRANGE, NESTED, and more
- PollBuilder with 7 templates, drag-and-drop sections, AI conversational generation
- Interactive 5-screen preview: welcome → sections → questions → completion → results (PollTakerModal)
- Fuzzy text matching for quizzes (Levenshtein + token-set + vowel-swap)
- Verification-weighted voting — poll power scales with user's 12-tier verification
- Anti-gaming: min dwell time, straightline detection, IP hashing

### 3. Marketplace & Commerce

**Files:** `app/products/`, `actions/products.ts`, `app/cart/`, `app/checkout/`

- Product CRUD, categories, company profiles
- Employee roles: OWNER, ADMIN, MEMBER
- Multi-warehouse inventory with real-time Socket.IO sync
- Bring/Posten shipping (rate calculation, booking, tracking)
- Cart → checkout → order flow with atomic stock reservation

### 4. Social (Pulse)

**Files:** `app/feed/`, `app/pulse/`, `components/uicustom/`

- Real-time feed with posts and reactions
- Follow/sync system
- DM and group conversations
- UserHoverCard with quick actions
- Notification bell with Pusher real-time updates

### 5. Web3 & Crypto Trading

**Files:** `components/crypto-related/`, `wagmiConfig/`

- BROWSERGAME-style grid inventory
- P2P trade windows with wallet-signed acceptance
- Multi-wallet: EVM (WalletConnect/Coinbase), Solana (Phantom/Solflare), Bitcoin
- VeggaSystem bot account with hardcoded multi-chain wallets

### 6. Authentication & Verification

**Files:** `auth.ts`, `auth.config.ts`, `auth-edge.config.ts`

- NextAuth v5: Google, GitHub, Discord OAuth + email/password + magic links
- 12-tier progressive verification: Anonymous (0.10x) → Fully Verified (1.20x)
- Verification multiplier affects poll voting weight and True Reach™ scoring

---

## Environment Setup

### Required `.env.local` (frontend)

```
DATABASE_URL                    # PostgreSQL connection
AUTH_SECRET                     # NextAuth encryption secret
NEXTAUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
AUTH_GITHUB_ID / AUTH_GITHUB_SECRET
AUTH_DISCORD_ID / AUTH_DISCORD_SECRET
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_PUSHER_KEY / NEXT_PUBLIC_PUSHER_CLUSTER
RESEND_API_KEY                  # Email service
GATE_PASSWORD                   # Gated access
EDGE_STORE_ACCESS_KEY / EDGE_STORE_SECRET_KEY
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3002
OPENAI_API_KEY / GROQ_API_KEY / GOOGLE_API_KEY  # Platform AI keys
BYOK_ENCRYPTION_KEY             # Min 32 chars, AES-256-GCM for BYOK
PLATFORM_OWNER_EMAIL            # Owner's email for owner-only AI keys
```

### Required `.env` (backend)

```
PORT=3001
WS_PORT=3002
BRING_MODE=mock
DATABASE_URL
PUSHER_APP_ID / PUSHER_KEY / PUSHER_SECRET / PUSHER_CLUSTER
CORS_ORIGINS
```

### Environment Routing

| Branch | Vercel Env | Database | Pusher Prefix |
|--------|-----------|----------|---------------|
| `main` | production | `DATABASE_URL_MAINLIVE` | *(none)* |
| `dev` / PRs | preview | `DATABASE_URL_MAINPREVIEW` | `preview__` |
| Local | development | `DATABASE_URL` | `dev__` |

---

## Common Tasks

### Start Development

```bash
npm install                          # Root (installs concurrently)
cd frontend && npm install && npx prisma generate && npx prisma migrate dev
cd ../backend && npm install
cd .. && npm run dev                 # Starts FE :3000 + BE :3001/:3002
```

### Modify Prisma Schema

1. Edit `frontend/prisma/schema.prisma`
2. Run `cd frontend && npx prisma migrate dev --name your-migration-name`
3. Run `npx prisma generate` (also regenerates on migrate dev)
4. If deploying to prod: `$env:NODE_ENV="production"; npx prisma db push` (Vercel doesn't run migrations)

### Add a Server Action

1. Create or edit a file in `frontend/actions/`
2. Add `"use server"` at the top
3. Define a Zod schema for input validation
4. Validate input, call Prisma, return typed result
5. Import and call from Server or Client Components

### Add an API Route

1. Create `frontend/app/api/{feature}/route.ts`
2. Export `GET`, `POST`, etc. as async functions
3. Validate request body with Zod
4. Add rate limiting (check `lib/unified-rate-limit.ts`)
5. Return `NextResponse.json(...)` or stream SSE

### Add BYOK Support to a Feature

1. Import from `lib/ai-key-store.ts` for key CRUD
2. Import from `lib/ai-key-crypto.ts` for encrypt/decrypt/normalize
3. Accept `aiAuth` in request body: `{ mode: "one_time", apiKey, provider, rememberKey? }`
4. Resolution order: inline key → saved key → platform key → error
5. Auto-detect provider from key prefix using `inferProviderFromApiKey()`

---

## Git & Deployment

```
feat/my-feature ──push──▶ CI ──PR──▶ dev ──verify──▶ main
                                      │               │
                                 Vercel Preview    Vercel Prod (veggat.com)
                                                   Railway Prod (backend)
```

- **CI runs on push to `main`/`dev`:** path filtering, frontend build + type-check + lint + Prisma validation, backend type-check
- **Vercel:** auto-deploys from `main` (prod) and `dev`/PRs (preview)
- **Railway:** auto-deploys backend from `main` (Docker)

---

## Conventions & Tags

- Server Components by default; `"use client"` only when interactivity is needed
- Add `@fileOverview` and `@stability` JSDoc tags to new files
- Use `shadcn/ui` primitives + custom composites in `components/uicustom/`
- Framer Motion for animations, Sonner for toast notifications
- Pusher channels: `{feature}-{id}` pattern

---

## Documentation

| File | Purpose |
|------|---------|
| `agent.md` | Full AI agent onboarding |
| `MasterContext.md` | Living invariants & module map |
| `architecture.md` | System design & data flows |
| `prd.md` | Product requirements & roadmap |
| `ONBOARDING.md` | Employee/contributor setup |
| `docs/REACH_7_PILLARS_SPECIFICATION.md` | True Reach™ scoring formulas |
| `docs/NORWAY_LEGAL_COMPLIANCE.md` | GDPR, DSA, Norwegian law |

**Precedence:** agent.md ≈ MasterContext.md > prd.md > architecture.md > feature docs.
