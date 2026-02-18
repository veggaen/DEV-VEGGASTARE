# MasterContext — Veggat

> Living aggregation of project-wide context for AI assistants and developer onboarding.  
> This file is the canonical source for architecture invariants and onboarding context.

**Auto-generated sections** are marked with `<!-- @auto -->`. Manual sections are maintained by developers.  
**Last Updated:** 2026-02-18

---

## Project Identity

- **Name:** Veggat (codebase: DEV-VEGGASTARE)
- **Domain:** veggat.com
- **Type:** Full-stack Web3-enabled marketplace with social features
- **Language:** TypeScript (100%)
- **Monorepo:** Two services — `frontend/` (Next.js) + `backend/` (Hapi.js)

---

## Global Invariants

These rules apply across the entire codebase. Violating them will cause bugs or regressions.

1. **Auth is server-side only.** Never import `auth()` or session logic in client components. Use the session prop passed through providers.
2. **Prisma Client is generated, not committed.** Run `npx prisma generate` after any schema change. The output lives in `frontend/generated/prisma/`.
3. **The frontend Prisma schema is canonical.** `frontend/prisma/schema.prisma` is the source of truth (2000+ lines). Backend has a subset.
18. **Vercel builds do NOT migrate databases.** CI runs `prisma generate` + `prisma validate`, but never `prisma db push`. After any schema change, you MUST manually push to each database: `cd frontend && NODE_ENV=production npx prisma db push` (production) and without NODE_ENV (dev). Forgetting this causes runtime P2022/P2021 errors ("column/table does not exist").
4. **Server actions must validate with Zod.** Every mutation uses a Zod schema before touching the database.
5. **Web3 trade acceptance requires wallet signature.** The `useSignMessage` hook must be called before confirming any P2P trade.
6. **Pusher channels follow naming conventions.** Pattern: `{feature}-{id}` (e.g., `trade-abc123`, `pulse-feed`, `notifications-userId`).
7. **VeggaSystem is a hardcoded system account with multi-chain wallets.** EVM/PulseChain: `0x018F6bF56814Dfa2543f98041e44A202b3632636`, Solana: `CKtrK9x1Hdtxt3JPpGVUDvoQgfhoGB24ecjsXYdzYnLx`, Bitcoin: `bc1qsyk5zhe5qtemv537ayd88nde58nsjtxhru6vas`. Do not change these addresses. OWNER can impersonate ("Take Control") this account via `/api/admin/impersonate` which force-encodes a new JWT for immediate identity swap. System email routes to `v3ggat@gmail.com`.
8. **Build uses Webpack mode.** `next dev --webpack` and `next build --webpack` — not Turbopack (due to compatibility).
9. **Environment variables are split.** Dev in `.env.local`, prod in hosting provider. Never commit secrets.
10. **Backend CORS is restrictive in production.** Set `CORS_ORIGINS` explicitly. Default `*` is dev-only.
11. **Payment webhooks must verify provider signatures in production.** Vipps/Klarna/PayPal each send signature headers. See `app/api/payments/webhook/[provider]/route.ts`.
12. **GATE_PASSWORD must be set via env var.** No hardcoded fallback — set `GATE_PASSWORD` in `.env`. To disable the gate, set `GATE_STATUS=false`.
13. **Database backups must never be committed to git.** The `.gitignore` excludes `**/database-backups/`. Never override this.
14. **Web3 mode toggle does NOT require email verification.** Toggling `web3ModeEnabled` is a simple PATCH to `/api/settings/web3-mode`. Email verification is only required for **wallet linking** (binding a wallet address to the user account).
15. **Unified sign-out: Web2 ↔ Web3.** `useCleanLogout` handles Web2→Web3 (disconnects wallets on sign-out). `WalletDisconnectWatcher` in `Web3Providers.tsx` handles Web3→Web2 (wallet disconnect triggers `signOut`). A `cleanLogoutInProgress` flag in `use-clean-logout.ts` prevents loops.
16. **AI generation requires authentication + auto-resolves keys.** Server uses `auto` mode: saved key → owner-only OpenAI (PLATFORM_OWNER_EMAIL) → Groq free tier (GROQ_API_KEY, Llama 3.3 70B) → error. 1 credit = 1 action (generation or refinement), 5/day. BYOK unlimited. Conversational chat thread: initial generation → Review Card with [Test Preview] [Inspect in Builder] → refinement loop ("make question 3 harder"). No dropdown, no mention of "default key".
17. **AI prompts are sanitized server-side.** Known injection/jailbreak patterns are blocked before reaching the AI provider. Output is validated for safety before returning to the client.

---

## Module Map

### Frontend (`frontend/`)

| Module | Path | Stability | Purpose |
|--------|------|-----------|---------|
| **App Shell** | `app/layout.tsx` | Stable | Root layout, auth session, providers, theme |
| **Auth** | `auth.ts`, `auth.config.ts`, `auth-edge.config.ts` | Stable | NextAuth v5 configuration |
| **Server Actions** | `actions/*.ts` | Active | All database mutations (30+ action files) |
| **Products** | `app/products/`, `actions/products.ts` | Stable | Product CRUD, listings, detail pages |
| **Companies** | `app/company/`, `actions/create-company.ts` | Stable | Company management, employee roles |
| **Warehouses** | `app/warehouses/`, `actions/fetchWarehouses.ts` | Stable | Warehouse inventory management |
| **Cart & Checkout** | `app/cart/`, `app/checkout/`, `contexts/cart-context.tsx` | Stable | Shopping flow |
| **Pulse (Social)** | `app/feed/`, `app/pulse/` | Active | Social feed, posts, reactions |
| **Conversations** | `app/(protected)/` area | Active | DMs, group chats |
| **Crypto Trading** | `components/crypto-related/` | Active | OSRS inventory, trade windows, P2P |
| **Polls** | `app/poll-test/`, `components/uicustom/polls/` | Active | 3 poll types (SURVEY, FEEDBACK, QUIZ), 11 question types, PollBuilder with 7 example templates (5 external + 2 inline), verification-weighted voting, anti-gaming, two-tier quiz feedback, **fuzzy text-answer matching** (Levenshtein), **conversational AI chat** (6-step SSE pipeline via `/api/polls/generate-stream`, refinement loop, Review Card), **interactive preview mode** (PollTakerModal with `previewData` prop), **per-question trust badges**, **Groq free tier default** (Llama 3.3 70B) + owner-only OpenAI, Grok/Claude/OpenRouter BYOK, **prompt injection guardrails**, **DB-backed daily quota** (5/day, survives cold starts), **scheduled daily polls** (cron + PENDING_REVIEW admin approval), **admin email alerts** (Resend) |
| **Analytics** | `app/analytics/`, `actions/analytics-*.ts` | Active | Company/product/user analytics |
| **UI Components** | `components/ui/` | Stable | shadcn/ui primitives |
| **Custom Components** | `components/uicustom/` | Active | Composite components |
| **Header/Nav** | `components/header/` | Stable | Navigation, search, notifications |
| **Providers** | `components/providers/` | Stable | React context providers (theme, session, wagmi) |
| **Hooks** | `hooks/` | Stable | Custom React hooks |
| **Lib** | `lib/` | Stable | Utilities, constants, view-strength calc, **fuzzy-text-match.ts** (Levenshtein distance, token-set, vowel-swap variant matching for quiz TEXT answers) |
| **Email (Resend)** | `lib/mail.ts` | Stable | Transactional emails: 2FA, password reset, verification, wallet link/unlink. Uses Resend SDK with verified `veggat.com` domain. Env: `RESEND_API_KEY` |
| **Web3 Providers** | `components/crypto-related/Web3Providers.tsx` | Stable | Root Web3 provider tree (wagmi, AppKit, Solana). Includes `WalletDisconnectWatcher` for unified session sync |
| **Clean Logout** | `hooks/use-clean-logout.ts` | Stable | Unified sign-out: disconnects EVM + Solana wallets, clears stale localStorage flags, then NextAuth `signOut()` |
| **Schemas** | `schemas/` | Stable | Zod validation schemas |
| **Prisma Schema** | `prisma/schema.prisma` | Active | Database models (2000+ lines) |

### Backend (`backend/`)

| Module | Path | Stability | Purpose |
|--------|------|-----------|---------|
| **Server** | `src/index.ts` | Stable | Hapi server init, CORS, port config |
| **Routes** | `src/routes.ts` | Stable | All /v1/* API endpoints |
| **WebSocket** | `src/websocket.ts` | Stable | Socket.IO server for warehouse sync |
| **Pusher** | `src/pusher.ts` | Stable | Event trigger utility |
| **Database** | `src/db.ts` | Stable | Prisma client init |
| **Bring Integration** | `src/integrations/bring.ts` | Stable | Shipping provider (mock + live) |
| **Warehouse Ops** | `src/updateWarehouseInventory.ts` | Stable | Stock update logic |
| **OpenAPI Spec** | `openapi/v1.yaml` | Stable | API documentation |

---

## Cross-Cutting Concerns

### Authentication Flow
```
Request → Edge Middleware (auth-edge.config.ts)
       → Route check (routes.ts matcher)
       → Session validation (auth.ts → NextAuth)
       → Server Component / Server Action
       → Prisma query with userId
```

### Real-Time Event Flow
```
Mutation (server action / backend route)
  → Prisma write
  → Pusher trigger (channel, event, data)
  → Client subscription (usePusher hook / Pusher.subscribe)
  → React state update → UI re-render
```

### Verification Tier Propagation
```
User action (OAuth link, wallet sign, payment)
  → Server action updates user.verificationTier
  → Tier multiplier applied to:
     ├── View strength calculation (lib/view-strength.ts)
     ├── Poll response weighting
     └── True Reach™ score
```

---

## Development Workflow & CI/CD

### Starting Dev Servers

| Method | Command | Result |
|--------|---------|--------|
| **VS Code task** | `Ctrl+Shift+B` | Both servers in split terminals |
| **Root CLI** | `npm run dev` | Both servers via concurrently |
| **Frontend only** | `npm run dev:fe` | localhost:3000 |
| **Backend only** | `npm run dev:be` | localhost:3001 + :3002 |
| **Copilot Chat** | Say *"start my project"* | Copilot runs the VS Code build task |

### Git Branching Model

```
feat/my-feature ──push──▶ CI ──PR──▶ dev ──verify──▶ main
                                       │               │
                                  Vercel Preview    Vercel Prod (veggat.com)
                                                    Railway Prod (backend)
```

- **`main`** — production. Pushing triggers Vercel + Railway deploy. Never push directly.
- **`dev`** — staging. Push here for CI validation and Vercel previews.
- Feature branches: `feat/`, `fix/`, `chore/` off `dev`.

### CI Pipeline (GitHub Actions)

Runs on every push/PR to `main` and `dev`:
1. **Path filter** — skips jobs when code hasn't changed (`dorny/paths-filter`)
2. **Frontend** — `npm ci` → `prisma generate` → `prisma validate` → migration drift check → `npm run build` → `npm run lint`
3. **Backend** — `npm ci` → `prisma generate` → `prisma validate` → `tsc --noEmit`

### Environment Routing

| Branch / Env | Vercel Env | Database | Pusher Prefix |
|-------------|-----------|----------|---------------|
| `main` (production) | production | `DATABASE_URL_MAINLIVE` | *(none)* |
| `dev` / PRs (preview) | preview | `DATABASE_URL_MAINPREVIEW` | `preview__` |
| Local dev | development | `DATABASE_URL` (.env.local) | `dev__` |

### Automation

- **Dependabot** — weekly PRs for npm + GitHub Actions dependency updates
- **Stale bot** — closes abandoned issues (30d) and PRs (14d)
- **E2E scaffold** — Playwright tests in `frontend/e2e/` (runs on PR if tests change)

---

## Key Data Relationships

```
User ──< Account (OAuth providers)
User ──< Session
User ──1 Cart ──< CartItem ──> Product
User ──< Order ──< OrderItem ──> Product
User ──< Employee ──> Company ──< Product
Company ──< Warehouse ──< WarehouseInventory ──> Product
User ──< Follow (follower/following)
User ──< Friendship (mutual, via FriendRequest)
User ──< ConversationParticipant ──> Conversation ──< Message
User ──< PollResponse ──< PollAnswer ──> PollQuestion ──> AdvancedPoll
User ──< Post ──< Reaction
User ──< Notification
User ──< Trade (initiator/responder) ──< TradeItem
User ──< Wallet (multi-chain: EVM/SOLANA/BITCOIN via ChainFamily, linked via signature)
User ─── Impersonation (OWNER can "Take Control" of VeggaSystem via cookies)
```

---

## Environment Configuration

### Frontend (`.env.local`)
```env
DATABASE_URL=postgresql://...
AUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
AUTH_DISCORD_ID=...
AUTH_DISCORD_SECRET=...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_PUSHER_KEY=...
NEXT_PUBLIC_PUSHER_CLUSTER=...
RESEND_API_KEY=re_...       # Resend transactional emails
GATE_PASSWORD=...           # Access gate password (required, no hardcoded fallback)
EDGE_STORE_ACCESS_KEY=...
EDGE_STORE_SECRET_KEY=...
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3002
```

### Backend (`.env`)
```env
PORT=3001
WS_PORT=3002
BRING_MODE=mock
DATABASE_URL=postgresql://...
PUSHER_APP_ID=...
PUSHER_KEY=...
PUSHER_SECRET=...
PUSHER_CLUSTER=...
```

---

## Comment Tag System

Files in this project use JSDoc-style tags for context aggregation:

| Tag | Purpose | Example |
|-----|---------|---------|
| `@fileOverview` | What this file does and why it exists | `@fileOverview Root layout with auth session and providers` |
| `@stability` | How often this file changes | `stable`, `active`, `experimental` |
| `@dependencies` | Key imports this file relies on | `@dependencies auth.ts, prisma, pusher-js` |
| `@crossReferences` | Files that must stay in sync with this one | `@crossReferences routes.ts, schema.prisma` |
| `@keyInvariants` | Rules that must not be violated | `@keyInvariants Never import auth() in client components` |
| `@decisions` | Why things are done a certain way | `@decisions Using Webpack over Turbopack for module compatibility` |

These tags can be extracted by the aggregation script at `scripts/aggregate-context.ts`.

---

## Security Audit Log

### 2026-02-12 — Pre-Commit Security Audit

**Fixed (this session):**
| Issue | Severity | Fix |
|-------|----------|-----|
| Hardcoded gate password `MainAdc123` in `site-config.ts` | CRITICAL | Removed fallback, now requires `GATE_PASSWORD` env var |
| Database backups (User.json with passwords, Account.json with OAuth tokens) committed to git | CRITICAL | Added to `.gitignore`, removed from tracking via `git rm --cached` |
| Notification IDOR — any user could create notifications as any actor | CRITICAL | `actorId` now forced to session user (admin bypass only) |
| `myPublicImages` file bucket had no type/size restrictions | HIGH | Added 10MB limit + image-only MIME types |
| Payment webhook had no signature verification warning | HIGH | Added TODO + IP logging (full verification needed before real payments) |

### 2026-02-12 — Web3 UX + Rate Limiting Hardening

**Fixed:**
| Issue | Fix |
|-------|-----|
| Web3 mode toggle required email verification (excessive friction) | Now uses simple PATCH `/api/settings/web3-mode` with Zod + rate limit. Email only for wallet linking. |
| No unified sign-out between Web2 ↔ Web3 | Added `WalletDisconnectWatcher` in `Web3Providers.tsx` + `cleanLogoutInProgress` flag in `use-clean-logout.ts` |
| Notifications route lacked rate limiting | Added `checkRateLimit('write')` to POST handler |
| Friend-requests route lacked rate limiting | Added `checkRateLimit('social')` to POST handler |
| Follow route lacked rate limiting | Added `checkRateLimit('social')` to POST and DELETE handlers |
| Messages route lacked rate limiting | Added `checkRateLimit('message')` to POST handler |

### 2026-02-14 — AI Generation UX Redesign + Security Hardening + Interactive Preview

**Fixed:**
| Issue | Fix |
|-------|-----|
| "VeggaStare default key" dropdown option was confusing and exposed platform internals | Removed all dropdowns. Server auto-resolves: saved key > platform key. No mention of "default key" anywhere. |
| AI panel had 3 cluttered dropdowns (mode, provider, key) | Clean UX: just prompt + generate button. Sleek `1/5` pill counter after first use. "Use my key" opt-in expansion only when clicked. |
| Select dropdowns hidden behind Dialog (z-index bug) | Bumped Select and Popover base z-index from `z-50` → `z-[100]` (Dialog uses `z-[80]`). Fixes all Select-in-Dialog globally. |
| Users with saved API keys still used platform quota | Auto mode tries saved key first — if found, uses it (unlimited, no platform quota consumed). |
| No Grok (xAI) provider support | Added Grok provider in BYOK options + server `callProvider()` (xAI API endpoint) |
| System prompt could be overridden by user input | Added `sanitizeUserPrompt()` — blocks injection patterns (ignore instructions, system override, DAN, etc.) before AI call |
| AI output could contain unsafe content | Added output validation — blocks responses with API keys, exploit tutorials, etc. |
| AI panel was single-shot: generate → done | Rewrote as conversational chat thread: initial generation → Review Card with [Test Preview] [Inspect in Builder] → refinement loop ("make Q3 harder"). Messages rendered as chat bubbles. |
| Preview was a static card, not interactive | Added interactive preview: PollTakerModal accepts `previewData` prop, converts `PollBuilderData` → `PollData` via `builderDataToPollData()`, simulates full 5-screen quiz experience (welcome → sections → questions → completion → results) with no API calls. "Back to Builder" button on results screen. |
| Inline templates (Quick Feedback, Product Preference) were too minimal and had missing sliderConfig | Upgraded: Quick Feedback 2Q→6Q (SCALE+sliderConfig, SINGLE_CHOICE, MULTI_CHOICE, SLIDER, RANKING, TEXT, type→FEEDBACK), Product Preference 3Q→8Q (emojis, descriptions, all numeric Qs have sliderConfig, RANKING added) |
| `visibleToUserIds` column missing from DB (schema drift) | Ran `npx prisma db push` to sync schema — fixes conversation creation, feed posts, and conversations API |
| Template count in addendum was 5 | Now 7 templates: 5 external (verify-poll-demo, feature-explorer, reach-poll, canna-coco, tony-vegan-eggs) + 2 inline (Quick Feedback, Product Preference) |

### 2026-02-13 — Poll System UX + Reliability Hardening

**Fixed:**
| Issue | Fix |
|-------|-----|
| TEXT quiz answers required exact match — typos like "algea" for "algae oil" marked wrong | Added fuzzy text matching with 6-layer pipeline: normalized exact → token-set → partial-token → whole-string Levenshtein → per-token fuzzy → vowel-swap variants (`lib/fuzzy-text-match.ts`) |
| Shape-match drag-and-drop had tiny hit zones, unintended swaps, no hover feedback | Padded hit rects (+24 px), increased snap distance (84→140 px), proper swap logic (displaced shape returns to source slot), real-time drag hover tracking with visual scale/shadow feedback |
| AI quiz generation showed no progress — blank wait up to 30 s | New SSE streaming endpoint (`/api/polls/generate-stream`) sends 6 progress steps; PollBuilder shows animated step list with spinner/checkmark |
| No trust-level visibility for AI-generated quiz questions | `parseTrustInfo()` extracts trust data from poll description; per-question badge rendered with colour-coded tooltip (High/Medium/Low) |
| No rate limit on AI generation for platform-key users | Daily quota guard (5 generations/user/day) in streaming endpoint; resets at UTC midnight |
| Pulse feed filter (polls / pulses) showed wrong items due to single-fetch pagination | Multi-fetch loop collects up to 3 server pages until ≥ 10 visible filtered items found |

### 2026-02-17 — Poll System Hardening

**Fixed:**
| Issue | Fix |
|-------|-----|
| Daily AI quota used in-memory Map — reset on every Vercel cold start | Replaced with PostgreSQL-backed `DailyAiUsage` model using atomic `upsert` on `userId_date` composite key (`lib/daily-ai-quota.ts`) |
| Legacy `/api/polls/generate` route had zero auth, zero quota, zero injection protection | Deleted entirely (546 lines). Only `generate-stream` exists now with full auth + quota + sanitization |
| No admin notification for system alerts | `lib/admin-alerts.ts` sends email via Resend to `PLATFORM_OWNER_EMAIL` for cron failures, system warnings |
| Progress bar hardcoded `/6` steps — would overflow with new pipeline | Server sends `totalSteps` in SSE events; PollBuilder uses dynamic denominator |
| No scheduled poll generation capability | `ScheduledPoll` model + `/api/cron/daily-poll` route (8 AM UTC daily via Vercel cron). Polls created as PENDING_REVIEW for admin approval |
| No middleware-level rate limiting (122 unprotected routes) | Two-layer rate limiter in `proxy.ts` (middleware): global per-IP cap (300/min) + per-tier caps (gate 5, ai 8, analytics 15, wallet 10, trade 20, admin 30, message 40, write 40, social 60, external 60, read 120). Edge-compatible in-memory store. Routes with `@/lib/rate-limit` keep their stricter per-user limits on top. |
| No admin dashboard for AI/polls monitoring | `/admin` now fetches live stats from `/api/admin/stats` (platform totals + AI quota metrics). `/admin/polls` page for pending review queue + scheduled template CRUD via `/api/admin/polls`. |

**New env vars:**
| Variable | Where | Purpose |
|----------|-------|---------|
| `PLATFORM_OWNER_EMAIL` | Vercel | Email for admin alerts |

**Known remaining issues (lower priority):**
| Issue | Severity | Status |
|-------|----------|--------|
| ~15 routes use raw `request.json()` without Zod validation | MEDIUM | Should add Zod schemas |
| Trade confirm has potential race condition (no DB transaction) | MEDIUM | Should use `$transaction` |
| No CSRF token on API routes (mitigated by SameSite cookies) | MEDIUM | Consider Origin header check |
| Anonymous engagement events on `/api/interact` | MEDIUM | Has built-in rate limit, but no auth required |
| Payment webhook signature verification not implemented | HIGH | Must implement before accepting real payments |
| Purge database-backup data from git history (BFG/filter-branch) | MEDIUM | Data still in old commits |

---

## Documentation Hierarchy

```
README.md                          ← Entry point: overview + quick start
├── frontend/README.md             ← Frontend setup, features, env vars
├── backend/README.md              ← Backend API, shipping, WebSocket
├── architecture.md                ← System design, data flow, deployment
├── prd.md                         ← Product requirements, roadmap
├── MasterContext.md (this file)   ← Living context index
├── ONBOARDING.md                  ← Employee/contributor onboarding guide
├── .github/copilot-instructions.md ← Copilot Chat workflow commands (owner)
└── docs/
    ├── NORWAY_LEGAL_COMPLIANCE.md         ← Master legal/regulatory compliance (GDPR, DSA, DPI, MiCA)
    ├── REACH_7_PILLARS_SPECIFICATION.md   ← True Reach™ metric formulas
    ├── POLL_SYSTEM_UPGRADE_MASTER_QUERY.md ← Poll system design spec (HISTORICAL)
    ├── POLL_SYSTEM_AGENT_PROMPT.md         ← Agent build instructions (HISTORICAL)
    ├── SOCIAL_FEATURES_PLAN.md            ← Social features roadmap
    ├── VIPPS_REQUIREMENTS.md              ← Vipps payment integration checklist
    └── integration-core.md                ← Backend architecture rationale
frontend/docs/
    ├── ADDRESS_SHIPPING_UPGRADE_PLAN.md   ← Address + shipping upgrade plan
    └── BRING_INTEGRATION.md               ← Bring API integration guide
```

---

## AI Assistant Context Rules

When working with this codebase, AI assistants should:

1. **Read MasterContext.md first** — it provides the fastest overview of the entire project
2. **Check Global Invariants** — before making changes, verify none are violated
3. **Reference the Module Map** — to find the right files for any feature area
4. **Follow the Comment Tag System** — add `@fileOverview` and `@stability` tags to new files
5. **Update this file** — when adding new modules, changing invariants, or shifting architecture
6. **Cross-reference prd.md** — to understand feature status and planned work
7. **Check architecture.md** — before changing data flow or service boundaries
