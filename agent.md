# VeggaStare — Agent Context

> Last Updated: 2026-02-28

The best senior engineers in history combined technical mastery with visionary impact, shaping modern infrastructure and technology. You are an expert full-stack engineer specialized in expanding the VeggaStare monorepo.

---

## Main Rules

Always presume dev servers are running in VSCode terminal window because I (the human Vegga from the basement) usually start this with `C:\Users\v3gga\Documents\DEV-VEGGASTARE> npm run start:project`.

---

## Project Structure (never change this)

```
Root: C:\Users\v3gga\Documents\DEV-VEGGASTARE\
├── package.json          # monorepo scripts: npm run start:project, dev:fe, dev:be, etc.
├── frontend/             # Next.js 16 (React 19, App Router, Tailwind 4, shadcn/ui via Radix
│                         #   + lucide-react + framer-motion + sonner + react-hook-form + zod)
├── backend/              # Hapi.js + Prisma
├── prisma/               # schema is in frontend/prisma/schema.prisma (canonical)
│                         #   and backend/prisma/schema.prisma (synced)
├── scripts/              # dev-start.ps1, dev-stop.ps1, aggregate-context.ts
├── docs/                 # Feature specs, legal, integration guides
├── MasterContext.md       # Global invariants — read before making changes
├── architecture.md        # Service boundaries, data flows, deployment
├── prd.md                 # Product Requirements Document — feature status tracking
└── ONBOARDING.md          # Employee setup guide
```

---

## Dev Workflow

- I always run `npm run start:project` in VSCode terminal.
- Presume both frontend (:3000) and backend (:3001 API + :3002 WS) dev servers are already running.
- Only give commands like "save the file and refresh browser" or "npm run prisma:generate" when needed.
- Frontend uses Webpack mode: `next dev --webpack`, `next build --webpack`.

---

## Existing AI Infra (use it!)

- **Models**: `UserAiApiKey`, `DailyAiUsage`, `AiConversation`, `AiConvParticipant`, `AiConvMessage`, `AiConvReaction`, `ScheduledPoll`
- User can have multiple AI keys (OPENAI, GROQ, ANTHROPIC, etc.) stored encrypted.
- `DailyAiUsage` already tracks quota per user per day.
- There is already an `/ai/chat` page — new builder will live at `/ai/builder`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | Next.js 16 (App Router, React 19) |
| Styling | Tailwind CSS 4, shadcn/ui (Radix primitives) |
| Animation | Framer Motion |
| Forms | react-hook-form + Zod validation |
| Toasts | Sonner |
| Icons | lucide-react, react-icons |
| Auth | NextAuth v5 (auth.ts / auth.config.ts) |
| ORM | Prisma (schema in frontend/prisma/schema.prisma) |
| Backend | Hapi.js (backend/src/) |
| Web3 | wagmi, viem, @reown/appkit, @solana/wallet-adapter |
| Real-time | Pusher (backend WebSocket on :3002) |
| Deployment | Vercel (frontend), Railway (backend) |
| CI | GitHub Actions (lint, type-check, build, Prisma validation) |

---

## Mandatory Rules (agent-friendly output)

1. **Always start every response with a short PLAN** (bullet points).
2. **Output either:**
   - Full new files with exact path (e.g. `frontend/app/ai/builder/page.tsx`)
   - OR precise git-style diffs/patches for existing files
3. **After code, always list exact commands** I need to run (e.g. "Save file → refresh browser", `npm run prisma:generate`, `npx prisma db push` if schema changes).
4. **Use ONLY existing tech**: Hapi.js routes in `backend/src/routes/`, Next.js Server Actions or fetch to `/api/ai/...` in frontend.
5. **Security:**
   - Always check user's `DailyAiUsage` quota first
   - Use user's default `UserAiApiKey` (or platform fallback)
   - Never expose keys
   - Rate limit endpoints
   - Validate all inputs with Zod
6. **UI/UX**: Premium shadcn style (dark mode first, glassmorphism, framer-motion transitions, responsive, loading skeletons, sonner toasts, react-hook-form + zod).
7. **Code conventions:**
   - Server Components by default. `"use client"` only when needed.
   - All mutations via server actions with Zod validation.
   - Add `@fileOverview` and `@stability` tags to new files.
   - Run `npx prisma generate` after schema changes.

---

## Response Format

Every response follows: **PLAN → CODE → COMMANDS → SECURITY/UX CHECKLIST**

### Few-Shot Examples

**Example 1 — New Route**
Task: "Add the /ai/builder page"
Plan: ...
Created `frontend/app/ai/builder/page.tsx` (full code)
Added Hapi route `backend/src/routes/ai.ts`
Commands: Save files → refresh http://localhost:3000/ai/builder

**Example 2 — Schema change**
Task: "Add a field to store generated code"
Plan: ...
Diff for `prisma/schema.prisma`
Commands: `npm run prisma:generate && npx prisma db push`

**Example 3 — Fix broken UI**
Task: "The existing AI chat page has bad mobile UX"
Plan: ...
Updated `frontend/app/ai/chat/page.tsx` with responsive grid
Commands: Save → hard refresh

---

## Git Rules

- **Never push directly to `main`.** Always `feature-branch → dev → main` or `dev → main`.
- **`dev`** is the staging branch (Vercel preview deployments).
- **`main`** is production (veggat.com + Railway backend).
- Feature branches: `feat/short-name`, `fix/short-name`, `chore/short-name`.

---

## Recent Feature: Seller Payment Setup (experimental)

Implemented 2025-06-19. Allows sellers (users and company owners) to configure PayPal receiving email + default crypto wallet for product sales.

### Key Files
| File | Purpose |
|------|---------|
| `frontend/actions/seller-payment.ts` | 6 server actions: save/verify/remove PayPal, set/remove default wallet, get status |
| `frontend/components/uicustom/settings/seller-payment-settings.tsx` | User settings → Payments section |
| `frontend/components/uicustom/settings/company-payment-settings.tsx` | Company settings → Payments section (owner only) |
| `frontend/app/(protected)/settings/verify-paypal/page.tsx` | PayPal email verification callback |
| `frontend/prisma/schema.prisma` | `PaypalVerificationToken` model (token-based email verification) |
| `frontend/lib/mail.ts` | `sendPaypalVerificationEmail()` added |
| `frontend/lib/rate-limit.ts` | `payment` tier: 8 req/60s |

### Security Measures
- `authAndRateLimit()` on every action (auth + rate limit combined)
- Timing-safe token comparison (`crypto.timingSafeEqual`)
- Email normalization (lowercase + trim)
- Zod validation with strict constraints (CUID regex, email max 254, token hex 64 chars)
- Company ownership assertion via `assertCompanyOwner()`
- Only verified wallets can be set as default receiving
- Generic error messages to prevent enumeration
- Structured audit logging via `createLogger('seller-payment')`
- Expired token cleanup (opportunistic + on verify)
- Token is 32 random bytes (256-bit entropy), 24h expiry, upsert pattern (1 active per entity)

### Schema Additions
- `PaypalVerificationToken` model: `id`, `email`, `token` (unique), `entityType`, `entityId`, `expires`, `createdAt`, `updatedAt`, `@@unique([entityType, entityId])`
- User/Company models: `paypalEmail`, `paypalEmailVerifiedAt`, `defaultReceivingWalletId` fields

### Checkout Integration (2026-02-27)
Seller payment settings are now wired into the checkout flow:

| Change | File |
|--------|------|
| `resolveCheckoutPayment()` server action | `frontend/actions/seller-payment.ts` — resolves seller wallet + PayPal per product in cart |
| Checkout uses seller wallet | `frontend/app/checkout/page.tsx` — `receiverAddress` prefers seller's EVM wallet over platform default |
| Seller PayPal routing | `frontend/app/api/payments/route.ts` + `frontend/lib/payments/providers.ts` — PayPal `payee.email_address` routes payment to seller |
| Fiat orders store receiver | `frontend/app/checkout/page.tsx` — fiat orders pass seller's PayPal email as `receiverAddress` in Payment record |
| Multi-seller handling | Platform escrow for multi-seller carts; direct payment for single-seller carts |
| Seller info badge | Checkout shows who the payment goes to (wallet address or PayPal email) |

**Resolution order** (per product): product `receiverWalletId` → company default → user default → platform fallback.

---

## Recent Feature: Unified Trading System (experimental)

Implemented 2026-02-28. Complete trade execution tracking across all 5 trading modes with Norwegian tax compliance.

### Trade Modes
| Mode | Color | Description |
|------|-------|-------------|
| P2P | emerald | Two-party trades via OsrsTradeWindow |
| SELF | purple | Self-transfers between own wallets |
| DEX | sky | DEX swaps via KyberSwap Aggregator |
| PAPER | amber | Simulated trades with virtual USD |
| LOCAL | orange | Local blockchain (Anvil/Ganache) trades |

### Key Files
| File | Purpose |
|------|---------|
| `frontend/lib/trade-record.ts` | Shared TradeRecord creation utility (`createTradeRecord`, `createP2PTradeRecords`) |
| `frontend/app/api/trades/history/route.ts` | GET — Paginated trade history with mode/status/date/token/tax-year filters |
| `frontend/app/api/trades/record/route.ts` | POST — Client-side trade recording (DEX/SELF/LOCAL modes) |
| `frontend/app/api/trades/tax-summary/route.ts` | GET — Server-side aggregated tax summary per year |
| `frontend/app/api/trades/[tradeId]/confirm/route.ts` | POST — P2P trade confirmation (now creates TradeRecords) |
| `frontend/actions/paper-trade.ts` | Paper buy/sell/swap (now creates TradeRecords) |
| `frontend/components/crypto-related/TradeHistory.tsx` | Full trade history panel with filters, CSV export, pagination |
| `frontend/components/crypto-related/PersonalTaxSummary.tsx` | Personal crypto tax widget (Skatteetaten-compatible) |
| `frontend/components/crypto-related/DexSwapPanel.tsx` | DEX swap panel (now logs TradeRecords on success) |
| `frontend/components/crypto-related/OsrsInventory.tsx` | Shift+click→trade transfer support |
| `frontend/components/crypto-related/OsrsTradeWindow.tsx` | `veggat:addToTrade` CustomEvent listener |
| `frontend/app/dashboard/trading/page.tsx` | Trading Hub: history toggle, always-visible trade panel |

### Schema Additions (in `frontend/prisma/schema.prisma`)
- `TradeRecord` model — unified execution log with sell/buy token pairs, USD/NOK pricing, tax fields
- `TradeMode` enum — P2P, SELF, DEX, PAPER, LOCAL
- `TradeRecordStatus` enum — PENDING, COMPLETED, FAILED, REVERTED
- `CostBasisMethod` enum — FIFO, AVERAGE
- `User.taxHelperEnabled`, `User.taxCostBasisMethod` fields

### Trade Recording Architecture
- **P2P**: Server-side, fire-and-forget after both parties confirm (in confirm route)
- **Paper**: Server-side, fire-and-forget after each `$transaction` (in server actions)
- **DEX**: Client-side, `useEffect` in DexSwapPanel fires POST to `/api/trades/record` on success
- **SELF**: Client-side, `useEffect` in SidebarWalletPanel fires POST to `/api/trades/record` on transfer success
- **LOCAL**: Client-side, inline POST in SidebarWalletPanel after LOCAL_RPC transfer receipt
- All records include NOK values via `getExchangeRates()` (ECB data via Frankfurter API)

### Norwegian Tax Compliance
- 22% capital gains rate (Skatteetaten)
- FIFO/AVERAGE cost basis method selection (saved to User record)
- Per-trade `gainLossUsd`/`gainLossNok` and `costBasisUsd`/`costBasisNok` tracking
- Tax year grouping with `taxYear` field + `taxExported` flag
- CSV export for Skatteetaten RF-1159 filing
- Server-side tax summary aggregation endpoint

### Cart & Product Enhancements (2026-02-27)

| Change | File |
|--------|------|
| Cart API: product fields | `frontend/app/api/cart/[userId]/route.ts` + `frontend/lib/types/carts.ts` + `frontend/contexts/cart-context.tsx` — `toCartDto` now includes `productType`, `shipFromPostalId`, `freeShippingEnabled`, `freeShippingThreshold` |
| My Sales: payment routing | `frontend/app/api/seller/orders/route.ts` + `frontend/app/(protected)/my-sales/page.tsx` — expanded Payment select to include all crypto + fiat routing fields; rich payment UI with status badge, crypto details, fiat recipient |
| Product page: accepted methods | `frontend/app/products/[...id]/ProductClient.tsx` — "Accepts:" badges showing crypto chains (from `acceptedTokens`) + fiat methods (PayPal, Vipps, Klarna) |

---

## E2E Testing Infrastructure (2025-07-24)

Playwright-based E2E testing following a **5-Layer Pyramid** architecture. All app tests live in ONE consolidated file (`suite.spec.ts`) plus a meta-test (`master.spec.ts`) that validates the test infrastructure itself.

### Architecture: Layered Pyramid + Meta-Test

```
e2e/
├── gate-bypass.ts   ← Infrastructure: bypass site access gate
├── auth.setup.ts    ← Infrastructure: log in and save session
├── helpers.ts       ← Single source of truth: route arrays, timeouts, utilities
├── suite.spec.ts    ← ALL app tests (5 layers, ~97 tests)
└── master.spec.ts   ← Meta-test: validates test infra (route sync, file integrity, coverage)
```

**Why ONE file?** Tests that scatter across 10 files rot. One pyramid means:
- Failures cascade UP (if health is down, skip everything above)
- New routes added to `helpers.ts` auto-expand tests via data-driven loops
- No duplicate coverage, no forgotten test files

### The 5 Layers

| Layer | Purpose | Examples |
|-------|---------|---------|
| **1 — Alive** (serial) | Is the system responding? | health endpoint, version, homepage |
| **2 — Routing** | Do gates work? | Public pages → 200, protected → redirect, APIs → 401/403 |
| **3 — Content** | Do pages render real content? | Login form inputs, register heading, legal pages |
| **4 — Flows** | Can users complete journeys? | Login→reset nav, register→login, /feed→/pulse |
| **5 — Data** | Are API shapes correct? | Products array, categories, pagination, SEO |

### The Master Meta-Test (5 Metas)

| Meta | Validates |
|------|-----------|
| **1 — Route Sync** | `helpers.ts` arrays match `routes.ts` source |
| **2 — File Integrity** | All 5 required test files exist |
| **3 — Coverage** | `suite.spec.ts` loops over all route arrays |
| **4 — Config** | `playwright.config.ts` has correct projects |
| **5 — Self-Check** | `master.spec.ts` itself is consistent |

### Running Tests

```bash
npm run test:e2e          # headless run
npm run test:e2e:ui       # interactive UI mode
npm run test:e2e:headed   # headed browser
npm run test:e2e:debug    # step-through debugger
```

### Playwright Project Structure

| Project | Purpose | Dependencies | Runs |
|---------|---------|-------------|------|
| `gate` | Bypass site access gate | — | `gate-bypass.ts` |
| `setup` | Log in (NextAuth credentials) | gate | `auth.setup.ts` |
| `no-auth` | All tests without login | gate | `suite.spec.ts` + `master.spec.ts` |
| `authed` | Tests with auth session (conditional) | setup | `suite.spec.ts` (only when E2E creds set) |

### Key Patterns & Anti-Patterns

**NEVER DO:**
- `networkidle` — never settles with SSE/WebSocket/streaming pages
- `innerText.length` assertions — fragile, locale-dependent
- `page.goto(url)` without `waitUntil: "domcontentloaded"` — hangs on first compile
- Scatter tests into 10+ files — leads to rot and duplicate coverage
- Test CSS classes or internal React state — tests USER BEHAVIOR

**ALWAYS DO:**
- Use `visitPage(page, path)` from helpers.ts — handles hydration automatically
- Use `domcontentloaded` + `waitForHydration()` for page loads
- Set `test.setTimeout(PAGE_TIMEOUT)` on browser tests (dev-mode first-compile is slow)
- Add routes to `helpers.ts` arrays — tests auto-expand
- Use API-level checks for speed; browser checks only for UX

### Learnings (hard-won)

- Products API returns **raw array** (NOT `{ products: [...] }`)
- Health API uses `dbLatencyMs` (not `latencyMs`)
- Auth pages may render empty shells — use soft assertions
- `/feed` redirects to `/pulse` (public alias, NOT protected)
- `shadcn FormControl` wraps inputs — use `getByPlaceholder()` not `getByLabel()`
- Dev server first-compile can take 30-60s per page; use 1 worker locally
- The `authed` project is conditionally excluded when no E2E creds are set

### Environment Variables for Auth Tests

- `E2E_TEST_EMAIL` — test account email (set in `.env.local`)
- `E2E_TEST_PASSWORD` — test account password
- `GATE_PASSWORD` — site access gate password (defaults to local value)
- Without credentials: authenticated tests skip (3 tests), `authed` project excluded

### Gate Handling

The site is in private testing mode (`SITE_MODE=private`). All routes redirect to `/gate`.
- For Playwright's own webServer: `GATE_STATUS=false` in config disables the gate
- For reusing local dev server: `gate-bypass.ts` setup project POSTs the password
- The gate cookie (`veggastare_access`) is shared via storageState to all dependent projects

---

## Environment Routing

| Branch / Env | Vercel Env | Database | Pusher Prefix |
|-------------|-----------|----------|---------------|
| `main` (production) | production | `DATABASE_URL_MAINLIVE` | *(none)* |
| `dev` / PRs (preview) | preview | `DATABASE_URL_MAINPREVIEW` | `preview__` |
| Local dev | development | `DATABASE_URL` (.env.local) | `dev__` |

---

## Documentation Maintenance

After completing any non-trivial change, check and update project docs if affected:

| File | Update when… |
|------|-------------|
| `MasterContext.md` | New modules, changed invariants, new env vars, architecture shifts |
| `agent.md` | Feature status changes, new tech, roadmap updates, new conventions |
| `architecture.md` | Service boundaries change, new data flows, deployment changes |
| `prd.md` | Features ship (⏳ → ✅), new features planned |
| `README.md` | Setup steps change, new tooling |
| `ONBOARDING.md` | Anything that affects employee workflow or setup |