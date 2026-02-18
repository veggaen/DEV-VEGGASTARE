# agent.md — Veggat Project Intelligence Brief

> **Purpose:** Single-file onboarding for any AI agent (Claude, GPT, Gemini, Copilot, etc.).  
> Read this file first → you'll understand the entire project, methodology, and current state.  
> **Last Updated:** 2026-02-18

---

## 1. What Is Veggat?

**Veggat** is a full-stack, Web3-enabled marketplace + social platform built in TypeScript.  
**Domain:** veggat.com | **Codebase name:** DEV-VEGGASTARE | **Owner:** v3gga (v3ggat@gmail.com)

Users can:
- Buy/sell digital products with company & warehouse management
- Trade crypto peer-to-peer (OSRS-style inventory UI, wallet-signed trades)
- Post to a social feed ("Pulse"), follow/sync with others, DM/group chat
- Create & take advanced polls/quizzes with AI generation
- Build reputation via the True Reach™ 7-pillar scoring system

---

## 2. Architecture at a Glance

```
              ┌──────────────┐
              │   Browser     │   React 19  ·  Web3 Wallets
              └──────┬───────┘
                     │ HTTPS / WSS / WalletConnect
       ┌─────────────┼──────────────┐
       ▼             ▼              ▼
  ┌─────────┐  ┌──────────┐  ┌──────────┐
  │ Vercel  │  │ Pusher   │  │ Reown    │
  │ Edge    │  │ (Events) │  │ Cloud    │
  └────┬────┘  └──────────┘  └──────────┘
       ▼
  ╔══════════════════════════════════════╗
  ║  FRONTEND SERVICE  (Next.js 16)     ║  Port 3000
  ║  App Router · Server Actions        ║  Deployed on Vercel
  ║  NextAuth v5 · Prisma 7.3           ║
  ╚════════════════╤═════════════════════╝
                   │ PostgreSQL
  ╔════════════════╧═════════════════════╗
  ║  BACKEND SERVICE  (Hapi.js 21)      ║  Port 3001 (HTTP) + 3002 (WS)
  ║  Bring Shipping · Socket.IO · Prisma 7.4   ║  Deployed on Railway
  ╚══════════════════════════════════════╝
```

**Two services, one database.** Frontend is the primary service (auth, DB writes, API routes, UI). Backend is an "Integration Core" for shipping, warehouse sync, and third-party connectors.

---

## 3. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (Webpack mode, NOT Turbopack) | 16.1.6 |
| UI | React + Tailwind CSS + shadcn/ui + Framer Motion | React 19 |
| Auth | NextAuth v5 (Google, GitHub, Discord OAuth + email magic links) | beta.7 |
| Database | PostgreSQL + Prisma ORM | Prisma 7 (both services) |
| Real-time | Pusher (events/notifications) + Socket.IO (warehouse sync) | — |
| Web3 | Reown/WalletConnect (AppKit), wagmi 2, Solana adapters | — |
| Backend | Hapi.js + Zod 4 + Bring shipping API | 21 |
| Email | Resend SDK (veggat.com domain) | — |
| File Storage | EdgeStore | — |
| Hosting | Vercel (frontend) + Railway (backend) + Neon/Supabase (DB) | — |
| Language | TypeScript 100% | — |

---

## 4. Codebase Map

```
DEV-VEGGASTARE/
├── frontend/                    # PRIMARY SERVICE — Next.js 16
│   ├── app/                     # App Router pages & API routes (~265 files)
│   │   ├── api/                 # ~120+ API routes
│   │   ├── feed/, pulse/        # Social feed
│   │   ├── products/            # Marketplace
│   │   ├── poll-test/           # Poll builder page
│   │   ├── (protected)/         # Auth-gated routes (conversations, etc.)
│   │   └── ...                  # cart, checkout, companies, dashboard, etc.
│   ├── components/              # UI components (~207 files)
│   │   ├── ui/                  # shadcn/ui primitives
│   │   └── uicustom/           # Custom composites (polls/, crypto-related/, etc.)
│   ├── actions/                 # Server actions (~27 files)
│   ├── prisma/schema.prisma     # CANONICAL schema (1920 lines, 77 models, 39 enums)
│   ├── lib/                     # Utilities (rate-limit, fuzzy-text-match, view-strength, etc.)
│   ├── hooks/                   # Custom React hooks
│   ├── schemas/                 # Zod validation schemas
│   └── generated/prisma/        # Generated Prisma client (not committed)
│
├── backend/                     # INTEGRATION CORE — Hapi.js 21
│   ├── src/                     # Source (~12 files)
│   │   ├── index.ts             # Server init
│   │   ├── routes.ts            # /v1/* API endpoints
│   │   ├── websocket.ts         # Socket.IO (warehouse sync)
│   │   └── integrations/        # Bring shipping (mock + live)
│   └── openapi/v1.yaml          # API docs
│
├── docs/                        # Specification documents
├── agent.md                     # THIS FILE — AI agent onboarding
├── MasterContext.md              # Living invariants & module map
├── architecture.md               # System design & data flows
└── prd.md                       # Product requirements & roadmap
```

---

## 5. Critical Rules (Global Invariants)

**Violating these will cause bugs.** Always check before making changes.

| # | Rule |
|---|------|
| 1 | **Auth is server-side only.** Never import `auth()` in client components. |
| 2 | **Prisma Client is generated, not committed.** Run `npx prisma generate` after schema changes. |
| 3 | **Frontend schema is canonical.** `frontend/prisma/schema.prisma` is the source of truth. |
| 4 | **Server actions validate with Zod.** Every mutation uses a Zod schema. |
| 5 | **Web3 trades require wallet signature.** `useSignMessage` before confirming any P2P trade. |
| 6 | **Pusher channels: `{feature}-{id}`** pattern (e.g., `trade-abc123`). |
| 7 | **VeggaSystem wallets are hardcoded (multi-chain):** EVM `0x018F...636`, Solana `CKtrK...nLx`, Bitcoin `bc1q...vas`. OWNER can impersonate via API. |
| 8 | **Webpack mode only.** `next dev --webpack` and `next build --webpack`. |
| 9 | **Never commit secrets.** Dev in `.env.local`, prod in hosting provider. |
| 10 | **Backend CORS is restrictive in production.** Only `*` in dev. |
| 11 | **Payment webhooks must verify signatures** before accepting real payments. |
| 12 | **GATE_PASSWORD via env var only.** No hardcoded fallback. |
| 13 | **Database backups never committed to git.** |
| 14 | **Web3 toggle ≠ email verification.** Only wallet linking requires email verification. |
| 15 | **Unified sign-out.** `useCleanLogout` + `WalletDisconnectWatcher` keep Web2↔Web3 sessions in sync. |
| 16 | **AI generation: auto-resolve chain.** saved key → owner OpenAI → Groq free tier → error. 5/day free, BYOK unlimited. |
| 17 | **AI prompts sanitized server-side.** Injection patterns blocked, output validated. |

---

## 6. Key Feature Areas

### Marketplace
Products, categories, company profiles, employee roles (OWNER/ADMIN/MEMBER), multi-warehouse inventory with real-time Socket.IO sync, Bring/Posten shipping (mock mode by default).

### Web3 & Crypto Trading
OSRS-style grid inventory, P2P trade windows with wallet-signed acceptance, VeggaSystem bot account (multi-chain: EVM/Solana/Bitcoin/PulseChain wallets), trade notifications with purple blink indicator. EVM (WalletConnect/Coinbase) + Solana (Phantom/Solflare). Multi-wallet support: users can link multiple wallets across chains (ChainFamily: EVM/SOLANA/BITCOIN). OWNER "Take Control" impersonation lets the owner act as VeggaSystem from profile or hovercard.

### Social (Pulse)
Real-time feed with posts/reactions, follow/sync system, DM/group conversations, UserHoverCard with quick actions, notification bell with real-time Pusher updates.

### Polls & Quizzes
**3 types:** SURVEY, FEEDBACK, QUIZ. **11 question types:** SINGLE_CHOICE, MULTI_CHOICE, SLIDER, SCALE, TEXT, RANKING, SHAPE_MATCH, UI_ARRANGE, NESTED + more.

Key capabilities:
- **PollBuilder** with 7 example templates, flow-based section ordering, drag-and-drop
- **AI conversational generation** — SSE streaming (6-step pipeline), chat thread with refinement loop, Review Card
- **Interactive preview** — full 5-screen quiz simulation (welcome → sections → questions → completion → results) via PollTakerModal
- **Fuzzy text matching** — Levenshtein + token-set + vowel-swap for forgiving quiz answers
- **Two-tier quiz feedback** — explanation → "Still don't understand?" → deepExplanation
- **Verification-weighted voting** — poll response power scales with user's verification tier
- **Anti-gaming** — min dwell time, rate limits, straightline detection, IP hashing
- **BYOK** — Bring your own API key (OpenAI, Anthropic, Grok, Groq, OpenRouter)
- **DB-backed daily quota** — 5 free AI generations/day via PostgreSQL (survives cold starts)
- **Scheduled daily polls** — Cron-based templates with PENDING_REVIEW admin approval flow

### True Reach™ (7 Pillars)
Proprietary engagement metric: Visibility (18%), Engagement Depth (25%), Conversion Impact (18%), Loyalty (14%), Growth (10%), Recall (5%), Velocity (10%). 12-tier verification multipliers affect all scoring.

### Authentication
NextAuth v5 with Google/GitHub/Discord OAuth, email/password, magic links, 12-tier progressive verification (Anonymous → Fully Verified with 0.10x–1.20x multipliers).

---

## 7. Database Overview

**77 Prisma models, 39 enums, 1920 lines** in `frontend/prisma/schema.prisma`.

Core entity relationships:
```
User ──< Account (OAuth)       User ──< Order ──< OrderItem ──> Product
User ──< Employee ──> Company  Company ──< Warehouse ──< WarehouseInventory
User ──< Follow                User ──< Friendship (via FriendRequest)
User ──< ConversationParticipant ──> Conversation ──< Message
User ──< PollResponse ──< PollAnswer ──> PollQuestion ──> AdvancedPoll
User ──< Post ──< Reaction     User ──< Trade ──< TradeItem
User ──< Wallet (multi-chain: ChainFamily EVM/SOLANA/BITCOIN)
User ─── Impersonation (OWNER → VeggaSystem via cookies)
User ──< Notification          User ──1 Cart ──< CartItem ──> Product
```

---

## 8. Environment Variables

### Frontend `.env.local`
```
DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL
AUTH_GOOGLE_ID/SECRET, AUTH_GITHUB_ID/SECRET, AUTH_DISCORD_ID/SECRET
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, NEXT_PUBLIC_PUSHER_KEY/CLUSTER
RESEND_API_KEY, GATE_PASSWORD, EDGE_STORE_ACCESS_KEY/SECRET_KEY
NEXT_PUBLIC_BACKEND_URL (http://localhost:3001)
NEXT_PUBLIC_WS_URL (http://localhost:3002)
OPENAI_API_KEY, GROQ_API_KEY, PLATFORM_OWNER_EMAIL, BYOK_ENCRYPTION_KEY
```

### Backend `.env`
```
PORT (3001), WS_PORT (3002), BRING_MODE (mock), DATABASE_URL
PUSHER_APP_ID/KEY/SECRET/CLUSTER, CORS_ORIGINS
```

---

## 9. Development Workflow

### Starting Dev Servers

| Method | Command | Result |
|--------|---------|--------|
| **VS Code task** | `Ctrl+Shift+B` | Both servers in split terminal panels |
| **Root CLI** | `npm run dev` | Both via concurrently (FE=cyan, BE=yellow) |
| **Frontend only** | `npm run dev:fe` | localhost:3000 |
| **Backend only** | `npm run dev:be` | localhost:3001 + :3002 |

```bash
# Full setup from scratch
npm install                      # root (concurrently)
cd frontend && npm install && npx prisma generate && npx prisma migrate dev && cd ..
cd backend && npm install && cd ..
npm run dev                      # starts everything
```

### Git Branching & Deployment

```
feat/my-feature ──push──▶ CI ──PR──▶ dev ──verify──▶ main
                                      │               │
                                 Vercel Preview    Vercel Prod (veggat.com)
                                                   Railway Prod (backend)
```

- **`main`** — production. Triggers Vercel + Railway deploy. Never push directly.
- **`dev`** — staging. Push here for CI validation and Vercel previews.
- Feature branches: `feat/`, `fix/`, `chore/` branched off `dev`.
- CI (GitHub Actions) runs on push/PR to `main` and `dev`: path-filtered builds, type-check, lint, Prisma validation, migration drift check.

### Environment Routing

| Branch / Env | Database | Pusher Prefix |
|-------------|----------|---------------|
| `main` (production) | `DATABASE_URL_MAINLIVE` | *(none)* |
| `dev` / PRs (preview) | `DATABASE_URL_MAINPREVIEW` | `preview__` |
| Local dev | `DATABASE_URL` (.env.local) | `dev__` |

### Copilot Chat Commands (owner only)

The owner (v3gga) has custom Copilot Chat commands in `.github/copilot-instructions.md`:
- **"start my project"** — launches both dev servers
- **"build to main"** / **"ship it"** — guarded deploy flow (dev → verify → main)
- **"status"** — check git branch, servers, CI

Employees/contributors follow `ONBOARDING.md` instead.

---

## 10. Current Status & Roadmap

### Shipped (Q4 2025 – Q1 2026)
- Full marketplace (products, cart, checkout, companies, warehouses, shipping)
- Web3 trading (OSRS inventory, P2P trades, wallet auth)
- Social features (Pulse feed, conversations, follow/sync, notifications)
- Advanced poll system (AI gen, interactive preview, 7 templates, 11 Q types)
- 12-tier verification, anti-gaming, fuzzy quiz matching
- Security hardening (rate limiting on critical routes, prompt injection guards, unified logout)
- Multi-wallet support (EVM/Solana/Bitcoin, sidebar panel, multi-chain linked wallets)
- System account impersonation ("Take Control" from profile/hovercard, amber header banner)

### In Progress
- True Reach™ score computation engine
- BYOK UX improvement (user-friendly onboarding for non-technical users)

### Planned (Near-term)
- Poll analytics dashboard (charts, response breakdowns)
- Velocity pillar (real-time engagement momentum)
- Profile editing (/settings — avatar, banner, bio)
- Vipps payment integration (Norwegian mobile payment)
- Friend request system (mutual friendships)
- Address + shipping upgrade (Bring booking, tracking, order emails)
- Rate limiting on remaining ~120 routes

### Planned (Future)
- Company customer chat (live support widget)
- Employee broadcasts
- User search at Pulse/feed level
- Mobile app (React Native or PWA)
- NFT marketplace integration
- GDPR data subject rights (export, deletion, restriction)
- DSA content moderation system
- Two-factor authentication (TOTP)

---

## 11. Known Technical Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| Payment webhook signatures not verified | HIGH | Must implement before real payments |
| Trade confirm has race condition (no `$transaction`) | MEDIUM | Should use DB transaction |
| Database backups in git history (old commits) | MEDIUM | Need BFG/filter-branch cleanup |
| GDPR data subject rights not implemented | HIGH (legal) | No export/delete/restrict endpoints |
| DSA content moderation not started | HIGH (legal) | No reporting/appeal mechanism |
| DPI tax reporting deadline passed (Jan 2026) | HIGH (legal) | Check if applicable |

---

## 12. Methodology & Conventions

### Code Style
- TypeScript strict mode
- Server Components by default, "use client" only when needed
- shadcn/ui primitives + custom composites in `components/uicustom/`
- Framer Motion for animations
- Zod for all input validation
- Toast notifications via Sonner

### File Organization
- Pages: `app/{route}/page.tsx`
- API routes: `app/api/{feature}/route.ts`
- Server actions: `actions/{feature}.ts`
- Components: `components/uicustom/{feature}/`
- Schemas: `schemas/{feature}.ts`

### Comment Tags (for context aggregation)
```
@fileOverview  — What the file does
@stability     — stable | active | experimental
@dependencies  — Key imports
@crossReferences — Files that must stay in sync
@keyInvariants — Rules that must not be violated
@decisions     — Why things are done a certain way
```

### Git & Deployment
- **Never push directly to `main`**. Always go `feature-branch → dev → main`.
- Frontend deploys to Vercel (auto-deploy on push)
- Backend deploys to Railway (Docker)
- CI runs on push/PR to `main` and `dev` (path-filtered, type-check, lint, Prisma drift)
- Never commit `.env`, `database-backups/`, or `generated/prisma/`
- Run `npx prisma generate` in CI/CD before build
- For employee/contributor workflows, see `ONBOARDING.md`

---

## 13. Document Map

| File | Purpose | Read When |
|------|---------|-----------|
| **agent.md** (this file) | Full project onboarding for AI agents | First — gives you the complete picture |
| **MasterContext.md** | Living invariants, module map, audit log | Before making changes — check invariants |
| **architecture.md** | System design, data flows, deployment, CI/CD | Before changing service boundaries |
| **prd.md** | Product requirements, feature status, roadmap | To understand what’s shipped vs planned |
| **ONBOARDING.md** | Employee/contributor quick-start guide | Giving someone access to the codebase |
| **.github/copilot-instructions.md** | Owner’s Copilot Chat workflow commands | Understanding the owner’s dev flow |
| **docs/REACH_7_PILLARS_SPECIFICATION.md** | True Reach™ metric formulas | Working on scoring/analytics |
| **docs/NORWAY_LEGAL_COMPLIANCE.md** | GDPR, DSA, DPI, cookie, payment compliance | Working on legal/regulatory features |
| **docs/SOCIAL_FEATURES_PLAN.md** | Friends, chat, broadcasts roadmap | Working on social features |
| **docs/VIPPS_REQUIREMENTS.md** | Norwegian payment checklist | Working on payment integration |
| **frontend/README.md** | Frontend setup, features, env vars | Setting up the frontend |
| **backend/README.md** | Backend API, shipping, WebSocket | Setting up the backend |

**Precedence rule:** agent.md ≈ MasterContext.md > prd.md > architecture.md > feature docs. Historical docs are audit-only.

---

## 14. Quick Start for AI Agents

1. **Read this file** — you now understand the project
2. **Check `MasterContext.md` invariants** — before making any code changes
3. **Find the right module** — use the Module Map in MasterContext or the Codebase Map above
4. **Run `npx prisma generate`** — if you touch `schema.prisma`
5. **Run `npm run build`** — to verify prod build after changes
6. **Update `MasterContext.md`** — when adding modules, changing invariants, or shifting architecture
7. **Update this file** — when the project state changes significantly

> **Business context:** Veggat is a Norwegian platform (ENK, org.nr 937 051 107) targeting the Nordic market. Norwegian legal compliance (Forbrukerkjøpsloven, GDPR, etc.) is relevant for payment and user data features.
