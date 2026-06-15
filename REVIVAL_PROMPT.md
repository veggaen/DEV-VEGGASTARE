# REVIVAL_PROMPT.md — VeggaStare (Freedom Store™) Reconstruction Blueprint

> **Last Updated:** 2025-07-12
> **Purpose:** A self-contained specification that captures every unique mechanism, cognitive pattern, UX innovation, and technical solution in VeggaStare. Hand this to any competent engineer (or future AI) and they should be able to reproduce every differentiating feature from scratch.
> **Author:** v3gga (Veggat)

---

## 1. Executive Summary

VeggaStare (branded **Freedom Store™**) is a full-stack TypeScript marketplace platform with integrated social features, AI chat, live polls, crypto trading, and real-time analytics. It is NOT a generic e-commerce template — it is a sovereign, multi-modal platform where every subsystem (social reach scoring, trading, polling, AI) interconnects through a unified identity and trust layer.

**What makes it unique (top-line):**

1. A 7-pillar behavioral scoring system (True Reach™) that replaces vanity metrics with real engagement measurement
2. A 14-tier progressive verification system that serves as a universal trust multiplier across ALL features
3. An Old School RuneScape-inspired P2P trading system with 5 unified trade modes
4. A BYOK (Bring Your Own Key) AI system with 6-provider support and platform-key free tier
5. An advanced poll system with 6 question types, streaming AI quiz generation, and analytics carousel
6. A Windows 11-style floating dock sidebar with 4-edge repositioning
7. Norwegian legal integration (Brønnøysundregistrene registry, Skatteetaten tax compliance)
8. A real-time Pulse Feed with inline polls, True Reach tracking, and behavioral analytics

**Core philosophy:** Users own their data, bring their own keys, verify progressively, and earn trust that compounds across every feature. No walled gardens.

---

## 2. Core Architecture

### 2.1 Two-Service Split

```
┌──────────────────────────────────┐     ┌─────────────────────────────┐
│  FRONTEND (Next.js on Vercel)    │────▶│  BACKEND (Hapi.js on Railway)│
│  Port 3000                       │     │  Port 3001 (HTTP)            │
│  Full-stack: UI + Server Actions │     │  Port 3002 (WebSocket)       │
│  + Prisma + Auth + Web3          │     │  Bring shipping + WS sync    │
└──────────────────────────────────┘     └─────────────────────────────┘
         │                                         │
         └────────────┬───────────────────────────┘
                      ▼
              ┌──────────────┐
              │  PostgreSQL   │
              │  (Neon)       │
              │  3 branches:  │
              │  Dev/Preview/ │
              │  Live         │
              └──────────────┘
```

**Why two services?**
- Frontend handles all user-facing logic, authentication, database mutations (server actions with Zod), Web3 wallet operations, AI chat
- Backend handles shipping integration (Bring API for Norwegian logistics), WebSocket-based warehouse real-time sync, and external connector patterns
- Both share Prisma schema + Pusher for real-time broadcast

### 2.2 Database Architecture (Neon PostgreSQL)

Three database branches with environment routing:

| Environment | DB Branch | Pusher Prefix | Vercel Env |
|------------|-----------|---------------|------------|
| Local dev | MainDev (`DATABASE_URL` in .env.local) | `dev__` | development |
| Preview / `dev` branch | MainPreview (`DATABASE_URL_MAINPREVIEW`) | `preview__` | preview |
| Production / `main` branch | MainLive (`DATABASE_URL_MAINLIVE`) | *(none)* | production |

### 2.3 Key Technical Decisions

- **Server Components by default.** `"use client"` only when interactivity requires it.
- **All mutations via server actions** — no raw API routes for data mutation. Every action validates with Zod.
- **Webpack mode** (`next dev --webpack`, `next build --webpack`) — not Turbopack.
- **Prisma is canonical** — the schema at `frontend/prisma/schema.prisma` is the single source of truth. Run `npx prisma generate` after any change. Vercel does NOT run migrations — production DB must be pushed manually (`npx prisma db push`).
- **Edge middleware** for auth + site gate — runs at CDN edge, checks JWT and cookie.

---

## 3. Unique Mechanisms — Complete Catalog

### 3.1 True Reach™ 7-Pillar Scoring System

**Concept:** Traditional social metrics (likes, follows, views) are vanity metrics. True Reach measures REAL behavioral engagement using 7 pillars inspired by the OSI network model — each layer builds on the one below it.

**The 7 Pillars:**

| # | Pillar | Weight | What It Measures | Key Formula |
|---|--------|--------|-----------------|-------------|
| 1 | **Visibility** | 18% | Genuine views with dwell-time filtering | `qualifiedViews = views.filter(v => v.dwellTime > 500ms && !v.botSignature)` |
| 2 | **Engagement Depth** | 25% | Scroll %, time-on-content, interaction density | `depthScore = (scrollDepth × 0.3) + (normalizedDwell × 0.4) + (interactionDensity × 0.3)` |
| 3 | **Conversion Impact** | 18% | Click-throughs, saves, shares, purchases | `conversionScore = (ctr × 0.25) + (saveRate × 0.25) + (shareRate × 0.25) + (purchaseRate × 0.25)` |
| 4 | **Loyalty & Retention** | 14% | Return visits, content affinity, session frequency | `loyaltyScore = (returnRate × 0.4) + (affinityScore × 0.3) + (sessionFrequency × 0.3)` |
| 5 | **Network Growth** | 10% | Organic follower growth, referral chains, community expansion | `growthScore = (organicGrowthRate × 0.4) + (referralDepth × 0.3) + (communityExpansion × 0.3)` |
| 6 | **Brand Recall** | 5% | Direct searches, unprompted mentions, return-without-prompt | `recallScore = (directSearchRate × 0.4) + (unPromptedMentions × 0.3) + (returnWithoutPrompt × 0.3)` |
| 7 | **Momentum Velocity** | 10% | Growth acceleration, trend consistency, viral coefficient | `velocityScore = (growthAcceleration × 0.4) + (trendConsistency × 0.3) + (viralCoefficient × 0.3)` |

**Final formula:**
```
trueReachScore = Σ(pillar_i × weight_i) → normalized to 0-100
```

**Anti-Gaming Mechanisms (per pillar):**
- **Visibility:** 500ms minimum dwell time, IP deduplication, bot signature detection
- **Engagement:** Scroll velocity anomaly detection, interaction burst rate limiting
- **Conversion:** Click-through verification windows, save-unsave pattern detection
- **Loyalty:** Session fingerprint consistency checks
- **Growth:** Follow-unfollow cycle detection, referral chain depth limits
- **Recall:** Search query intent classification
- **Velocity:** Sudden spike investigation triggers

**Implementation:**
- `useReachTracker` hook tracks: scroll depth, dwell time, tab visibility, hover deep-reads, copy events, return visits
- Data flows through server actions → Prisma → aggregated per-content-item
- Scores are recalculated on read (not cached) for freshness

---

### 3.2 14-Tier Progressive Verification System

**Concept:** Identity trust is earned progressively. Every action on the platform (viewing, voting, trading, selling) is weighted by how much the system trusts you. This is NOT binary (verified/unverified) — it's a 14-step spectrum.

**The Tiers:**

| Tier | Name | Multiplier | How to Reach |
|------|------|-----------|-------------|
| 0 | `ANONYMOUS` | 0.10x | No account / not logged in |
| 1 | `UNVERIFIED` | 0.15x | Account created, email not verified |
| 2 | `EMAIL_VERIFIED` | 0.25x | Email verified via token |
| 3 | `WALLET_ONLY` | 0.30x | Crypto wallet connected + signed |
| 4 | `WEB2_BASIC` | 0.40x | 1 OAuth provider linked |
| 5 | `WEB2_SOCIAL` | 0.50x | 2+ OAuth providers linked |
| 6 | `GOOGLE_VERIFIED` | 0.55x | Google OAuth specifically |
| 7 | `MULTI_OAUTH` | 0.65x | 3+ providers cross-verified |
| 8 | `WALLET_PLUS_SOCIAL` | 0.75x | Wallet + 2+ OAuth |
| 9 | `PAYMENT_LINKED` | 0.85x | PayPal verified or payment method |
| 10 | `PAYMENT_VERIFIED` | 0.95x | Completed real transaction |
| 11 | `PHONE_VERIFIED` | 1.00x | Phone number verified |
| 12 | `KYC_VERIFIED` | 1.10x | Full KYC completed |
| 13 | `FULLY_VERIFIED` | 1.20x | All verification methods completed |

**Where multipliers apply:**
- **True Reach:** View strength = base × tierMultiplier
- **Polls:** Vote weight = tierMultiplier × completionMultiplier × responseQuality
- **Trading:** Higher tiers unlock higher trade limits
- **Content:** Trust badges displayed next to username

**Tier recalculation triggers:**
- OAuth link event, wallet signature, payment completion, phone verification, KYC approval
- Automatic via server action — no manual admin intervention needed

---

### 3.3 OSRS-Style P2P Trading System

**Concept:** Inspired by Old School RuneScape's trading interface. Two players see each other's offer grids, drag items from an inventory, and must both accept twice before the trade executes. This creates a trust ceremony that prevents scams.

**The Inventory (OsrsInventory.tsx):**
- **4×7 grid** = 28 fixed slots (like OSRS)
- Empty slots render as dark "stone" squares with subtle borders
- Occupied slots show: token icon + stacked quantity overlay
- Reads real ERC-20 tokens and NFTs from connected wallets
- **Drag-and-drop** with modifier keys:
  - Default drag = full stack
  - Shift+drag = half stack
  - Ctrl+drag = third of stack
- **Right-click context menu:** Split, Copy Address, Send, Add to Trade
- Chain switching support (view different wallet chains)
- Search/filter by token name or symbol

**The Trade Window (OsrsTradeWindow.tsx — 1922 lines):**
- **Dual 4×4 offer grids** — "Your Offer" (left) and "Their Offer" (right)
- Items dragged from inventory into offer grid
- **Two-step accept:**
  1. First accept = "I'm done adding items"
  2. Second accept = "I confirm this exact trade"
  3. If either party modifies their offer, both accepts reset
- **Self-trade mode:** Trade between your own wallets (select source + destination from connected wallets via dropdown)
- **ERC-20 transfer encoding:** Manual calldata construction using `encodeFunctionData` from viem — `transfer(address,uint256)` calls built per-item
- **Real-time sync:** Trade state broadcast via Pusher channel per trade session

**5 Unified Trade Modes (all share `TradeRecord` model):**

| Mode | Description | Blockchain? | Tax Tracked? |
|------|------------|-------------|-------------|
| `P2P` | Two users, OSRS-style grids | Yes (EVM) | Yes |
| `SELF` | Between own wallets | Yes (EVM) | Yes |
| `DEX` | KyberSwap/0x aggregator swap | Yes (EVM + Solana) | Yes |
| `PAPER` | Database-simulated, no real crypto | No | No |
| `LOCAL` | Ganache devnet trades | Yes (local) | No |

**Norwegian Tax Compliance (Skatteetaten):**
- 22% capital gains tax rate
- FIFO and AVERAGE cost basis methods
- RF-1159 CSV export format for annual tax filing
- Automatic gain/loss calculation per trade

---

### 3.4 DB-Simulated Paper Trading

**Concept:** Practice cryptocurrency trading with a virtual $100K portfolio using real market prices but zero blockchain infrastructure cost.

**Phase 1 — Current (DB-Simulated):**
```
User Action → Server Action → Prisma DB Write → Portfolio Update
    ↓
Real prices from CoinGecko / 0x API (read-only)
    ↓
PaperPortfolio { userId, holdings[], cash, totalValue }
PaperTrade { type, tokenIn, tokenOut, amountIn, amountOut, priceAtExecution }
```
- Virtual $100K starting balance
- Buy/sell with real market prices (fetched at execution time)
- Full portfolio tracking: holdings, cost basis, P&L, trade history
- Zero blockchain transactions — 100% database
- Serverless-friendly (no WebSocket connections to chain needed)

**Phase 2 — Planned (Tenderly/Anvil Fork):**
- Fork mainnet at specific block
- Execute real contract calls on fork
- Get actual gas estimates and revert reasons
- Still no real money at risk

**Phase 3 — Planned (DEX Integration):**
- Graduate from paper → real swaps
- 0x Swap API for EVM chains
- KyberSwap DEX aggregator for cross-chain
- Unified swap UI: token selector → amount → route preview → execute

---

### 3.5 BYOK (Bring Your Own Key) AI System

**Concept:** Users can chat with AI assistants without the platform eating costs. Free tier uses platform keys for cheap/free providers. Power users bring their own API keys for premium models.

**Provider Support (6 providers):**

| Provider | Tier | Free w/ Platform Key? |
|----------|------|-----------------------|
| Google (Gemini) | free | Yes |
| Groq | free | Yes |
| Grok (xAI) | free | Yes |
| OpenAI (GPT-4o) | premium | No — BYOK or credits |
| Anthropic (Claude) | premium | No — BYOK or credits |
| OpenRouter | byok-only | No — always BYOK |

**Key Resolution Order:**
1. User's preferred provider key (if set as default)
2. Any stored key (sorted by `isDefault` then `updatedAt`)
3. Platform key fallback (free-tier providers only)

**Security:**
- Keys encrypted at rest with AES-256-GCM
- Keys never sent to client — decrypted server-side only at call time
- Key validation on save (test API call)

**Quota System:**
- Free-tier: 20 AI generations per day (tracked via `DailyAiUsage` model)
- BYOK users: unlimited (bypasses daily quota)
- Usage counter resets at midnight UTC

**UI Features:**
- Auto-detects provider from API key prefix (e.g., `sk-` → OpenAI)
- Model selector syncs with detected provider
- Key management page: add/remove/set-default per provider

---

### 3.6 Advanced Poll System

**Concept:** Not just yes/no polls. A full survey engine with 6 question types, partial completion tracking, response quality scoring, and rich analytics.

**6 Question Types:**

| Type | UX | Data |
|------|-----|------|
| `SINGLE_CHOICE` | Radio buttons | One selected option |
| `MULTI_CHOICE` | Checkboxes | Array of selected options |
| `SLIDER` | Range slider (min/max/step) | Numeric value |
| `SCALE` | Star rating or 1-10 | Numeric value |
| `TEXT` | Free text input | String response |
| `NESTED` | Conditional follow-ups | Tree response |

**Poll Builder (PollBuilder component):**
- Drag-and-drop question reordering
- Per-question configuration (required/optional, min/max responses)
- **Ctrl+V image paste** — paste screenshots directly into question/option images
- Live preview mode

**Response Quality Scoring:**
```
weightedVote = tierMultiplier × completionMultiplier × responseQuality

completionMultiplier: {
  100% answered = 1.0x,
  75-99% = 0.8x,
  50-74% = 0.6x,
  25-49% = 0.3x,
  <25% = 0.1x
}

responseQuality: {
  textLength > threshold = bonus,
  consistent answers = bonus,
  speedrun detection = penalty
}
```

**Analytics Carousel (5 chart types):**
1. **Radar chart** — Multi-dimensional response overview
2. **Bar chart** — Option frequency distribution
3. **Pie chart** — Proportional breakdown
4. **Line chart** — Response trends over time
5. **Heatmap** — Cross-question correlation matrix

**Integration with True Reach:**
- Poll engagement feeds Pillar 2 (Engagement Depth)
- Poll completion rate feeds Pillar 4 (Loyalty)
- Poll sharing feeds Pillar 3 (Conversion Impact)

---

### 3.7 AI Quiz Generation with SSE Streaming

**Concept:** Users describe a topic and AI generates a full poll/quiz in real-time with visible progress.

**6-Step Streaming Pipeline:**
```
1. [VALIDATING]  → Sanitize user prompt (anti-injection)
2. [GENERATING]  → AI produces questions via provider
3. [PARSING]     → Extract structured JSON from response
4. [ENRICHING]   → Add metadata, difficulty scores
5. [SAVING]      → Persist to database via Prisma
6. [COMPLETE]    → Return poll ID, redirect to poll
```

Each step fires a Server-Sent Event (SSE) with progress percentage and status message.

**Anti-Injection:**
- `sanitizeUserPrompt()` strips prompt injection attempts
- Trust score annotation based on user verification tier
- Rate limiting per user per hour

---

### 3.8 Windows 11 Floating Dock Sidebar

**Concept:** The dashboard navigation is a floating pill that sticks to any screen edge — like the Windows 11 taskbar but repositionable.

**Implementation:**
```tsx
// Position: fixed, NOT in document flow
// Glass pill design: backdrop-blur + rounded-2xl + shadow
// 4 positions: left | right | top | bottom

const FLOATING_GAP = 8;       // px from screen edge
const COLLAPSED_SIZE = 52;     // px — icon-only bar
const EXPANDED_V_WIDTH = 240;  // px — full labels visible
const DOCK_H_APPROX = 48;     // px — horizontal bar height
```

**Key UX decisions:**
- **Portal-based dropdown:** The position picker dropdown renders via `createPortal(document.body)` — prevents z-index and overflow clipping issues
- **Content compensation:** `DashboardShell` adds dynamic padding opposite the dock position so content never slides under the dock
- **Collapse = minimize:** Dock shrinks to icon-only bar but never disappears (always has minimum 52px visible)
- **LocalStorage persistence:** Position + expanded state saved in `veggat:dock-position` and `veggat:dock-expanded`
- **Hydration-safe:** Default state on server, actual state applied after mount

---

### 3.9 Pulse Feed (Real-Time Social)

**Concept:** A social feed where every interaction generates behavioral data that flows into True Reach scoring.

**Post Types:**
- Standard text posts
- Image posts (EdgeStore uploads)
- Poll posts (inline PollBuilder)
- Repost / Quote-repost
- "Pulse" reactions — positive or negative (like a heartbeat, not a simple like)

**Real-Time Architecture:**
- Pusher channel: `pulse-feed` (public), `private-pulse-{userId}` (notifications)
- New post → broadcast to subscribers → optimistic UI update
- Comment threads with nested replies
- Intercepting modal route (`@modal/(.)[id]`) for in-feed poll viewing without page navigation

**Behavioral Tracking (feeds True Reach):**
- Scroll depth per post
- Dwell time per post
- Tab visibility (did they switch away?)
- Hover deep-reads (cursor lingering on content)
- Copy events (did they copy text?)
- Return visits (came back to this post later)

---

### 3.10 Seller Payment Routing

**Concept:** When a buyer purchases from the marketplace, payment must reach the correct seller. Multi-seller carts are handled transparently.

**Resolution Chain (3-level cascade):**
```
1. Product-level: product.receiverWalletId
     ↓ (if not set)
2. Company-level: company.defaultReceivingWalletId
     ↓ (if not set)
3. User-level: user.defaultReceivingWalletId (verified wallets only)
```

**PayPal follows same pattern:**
```
1. Company PayPal email
     ↓ (if not set)
2. User PayPal email (must be verified)
```

**PayPal Email Verification:**
- Send verification token to PayPal email
- Timing-safe token comparison (prevents timing attacks)
- 24-hour token expiry
- Email must be verified before receiving payments

**Multi-Seller Cart Handling:**
- `resolveCheckoutPayment()` resolves each product independently
- If all products → same destination: unified payment target
- If products → different destinations: `multiSeller: true` flag
- Future: multi-seller escrow splitting

**Supported Payment Rails:**
- Crypto: EVM direct transfer (ETH + ERC-20) + Solana SPL
- Fiat: PayPal

---

### 3.11 Site Gate (Private Testing Mode)

**Concept:** Lock the entire site behind a password while in development/private beta.

**How it works:**
```
ENV: SITE_MODE=private, GATE_STATUS=enabled, GATE_PASSWORD=<secret>

Middleware (Edge):
  → Check cookie: veggastare_access
  → Cookie value: "granted_<base64(password prefix)>"
  → If missing/invalid → redirect to /gate
  → If valid → pass through
```

**Whitelisted routes (bypass gate):**
- `/gate` itself
- `/privacy`, `/terms`, `/info` (legal pages)
- `/api/auth/*` (OAuth callbacks)
- `/api/webhooks/*` (external integrations)

**Fail-safe:** Gate auto-disables if `GATE_PASSWORD` is not set.
**API routes:** Return `{ error: "Access denied" }` JSON 401 instead of redirecting.

---

### 3.12 Norwegian Legal Integration

**Brønnøysundregistrene (Business Registry):**
- Live org number lookup via public API
- Auto-fill company name, address, legal form
- Map Norwegian legal forms to platform types:
  - AS → Corporation, ENK → Sole Proprietorship, ANS/DA → Partnership
  - SA → Cooperative, NUF → Foreign Branch, FORENING → Association
- 9-digit org number validation + formatting (XXX XXX XXX)

**Skatteetaten (Tax Authority) Compliance:**
- 22% capital gains tax rate on crypto
- FIFO and AVERAGE cost basis methods supported
- RF-1159 CSV export for annual tax filing
- Automatic gain/loss calculation per trade
- All trades logged in unified `TradeRecord` model

---

### 3.13 5-Layer E2E Test Pyramid

**Concept:** A single-file test architecture that validates the entire app in systematic layers, from "is it alive?" to "do complex flows work?"

**Architecture:**
```
suite.spec.ts    → 93+ tests across 5 layers (single file)
master.spec.ts   → Meta-test that validates suite.spec.ts ran correctly
helpers.ts       → Data-driven route expansion, shared utilities
```

**The 5 Layers:**
1. **Alive** — Server responds, no 500s on critical routes
2. **Routing** — All pages load, redirects work, auth guards enforce
3. **Content** — Expected elements visible, text correct, images load
4. **Flows** — Multi-step user journeys (register → login → create → view)
5. **Data** — API responses match schema, database state correct

**Data-driven route expansion:**
- `helpers.ts` exports route arrays with metadata (auth required?, expected status code, expected elements)
- Tests iterate over routes programmatically — adding a new page to the array = automatic test coverage

**Meta-test validation:**
- `master.spec.ts` reads suite results and asserts:
  - All 5 layers ran
  - No unexpected skips
  - Pass rate above threshold

---

### 3.14 LocalDevTools Panel

**Concept:** When running against local Ganache chains, a developer panel provides blockchain manipulation tools.

**Capabilities:**
- Mine blocks on demand
- Snapshot current chain state / revert to snapshot
- Set arbitrary ETH balance for any address
- Send ETH from any account (no private key needed on Ganache)
- View current block number and chain state
- Two chains: 31337 (port 8545) and 1337 (port 7545)

---

### 3.15 Warehouse Real-Time Sync

**Concept:** Warehouse inventory changes are broadcast in real-time to all connected clients via a dual-channel system.

**Architecture:**
```
Warehouse Update → Backend (Hapi.js)
   ├── Socket.IO emit (bidirectional, for warehouse operators)
   └── Pusher broadcast (unidirectional, for dashboard viewers)
```

**Why dual-channel?**
- Socket.IO: Persistent connection for warehouse terminals that need to SEND updates (barcode scans, stock adjustments)
- Pusher: Serverless-friendly broadcast for dashboard users who only RECEIVE updates

---

## 4. Tech Stack (Current)

### 4.1 Frontend
| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 16 | App Router, React 19, Webpack mode |
| Styling | Tailwind CSS | 4 | CSS-first config |
| Components | shadcn/ui (Radix) | Latest | + custom components in `uicustom/` |
| Animation | Framer Motion | Latest | Page transitions, micro-interactions |
| Auth | NextAuth.js | v5 | JWT strategy, Edge middleware |
| ORM | Prisma | 7.3/7.4 | PostgreSQL, 2000+ line schema |
| Web3 | wagmi + viem + Reown AppKit | Latest | EVM wallets |
| Web3 (Solana) | @solana/wallet-adapter | Latest | Solana wallets |
| Real-time | Pusher (client) | Latest | Channels for feed, trade, notifications |
| File uploads | EdgeStore | Latest | Image/document storage |
| Testing | Playwright | ^1.58.0 | E2E, 5-layer pyramid |

### 4.2 Backend
| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Hapi.js | Latest | HTTP + plugin system |
| WebSocket | Socket.IO | Latest | Warehouse real-time |
| Real-time | Pusher (server) | Latest | Broadcast to frontend |
| Shipping | Bring API | Latest | Norwegian logistics |
| ORM | Prisma | 7.3/7.4 | Shared schema with frontend |

### 4.3 Infrastructure
| Service | Provider | Notes |
|---------|----------|-------|
| Frontend hosting | Vercel | Auto-deploy from main/dev |
| Backend hosting | Railway | Auto-deploy from main |
| Database | Neon PostgreSQL | 3 branches (Dev/Preview/Live) |
| Real-time | Pusher | Channels service |
| Domain | veggat.com | Production |

---

## 5. Build Pipeline & CI/CD

```
Feature Branch → Push → CI (GitHub Actions)
    │                      ├── Path filtering (only changed service)
    │                      ├── Frontend: build + type-check + lint + Prisma validate + migration drift
    │                      └── Backend: type-check
    │
    ▼
dev branch → Vercel Preview Deploy → Manual verification
    │
    ▼
main branch → Vercel Production Deploy (veggat.com)
             + Railway Backend Deploy
             + Manual Prisma db push (if schema changed)
```

**Critical: Vercel does NOT run Prisma migrations.** After schema changes, you MUST run:
```bash
cd frontend
NODE_ENV=production npx prisma db push
```

---

## 6. UI/UX Specification

### 6.1 Design System
- **Dark mode primary** — glass/frosted surfaces, OKLCH colors
- **shadcn/ui base** — Radix primitives for accessibility
- **Custom components** in `components/uicustom/` — platform-specific UI (dock, trade windows, inventory grids)
- **Framer Motion** — page transitions, expandable sections, hover effects, stagger animations

### 6.2 Dashboard Layout
```
┌─────────────────────────────────────────┐
│                                         │
│  ┌─────┐                                │
│  │DOCK │  ← Fixed floating pill         │
│  │     │     (can be on any edge)       │
│  │ 🏠  │                                │
│  │ 📊  │     ┌──────────────────┐       │
│  │ 💬  │     │   CONTENT AREA   │       │
│  │ 🔄  │     │   (padded to     │       │
│  │ ⚙️  │     │    avoid dock)   │       │
│  │     │     └──────────────────┘       │
│  └─────┘                                │
│                                         │
└─────────────────────────────────────────┘
```

### 6.3 Trading UI
```
OSRS Trade Window:
┌─────────────┬─────────────┐
│ YOUR OFFER  │ THEIR OFFER │
│ ┌──┬──┬──┬──┐ ┌──┬──┬──┬──┐ │
│ │  │  │  │  │ │  │  │  │  │ │
│ ├──┼──┼──┼──┤ ├──┼──┼──┼──┤ │
│ │  │  │  │  │ │  │  │  │  │ │
│ ├──┼──┼──┼──┤ ├──┼──┼──┼──┤ │
│ │  │  │  │  │ │  │  │  │  │ │
│ ├──┼──┼──┼──┤ ├──┼──┼──┼──┤ │
│ │  │  │  │  │ │  │  │  │  │ │
│ └──┴──┴──┴──┘ └──┴──┴──┴──┘ │
│ [ACCEPT 1/2]  [DECLINE]     │
└─────────────┴─────────────┘

OSRS Inventory:
┌──┬──┬──┬──┐
│🪙│🪙│  │  │ Row 1
├──┼──┼──┼──┤
│🪙│  │  │  │ Row 2
├──┼──┼──┼──┤
│  │  │  │  │ ...
├──┼──┼──┼──┤
│  │  │  │  │
├──┼──┼──┼──┤
│  │  │  │  │
├──┼──┼──┼──┤
│  │  │  │  │
├──┼──┼──┼──┤
│  │  │  │  │ Row 7
└──┴──┴──┴──┘
28 slots total (4×7)
Right-click: Split | Copy | Send | Trade
Drag: full stack | Shift=half | Ctrl=third
```

---

## 7. Security Model

### 7.1 Authentication Flow
```
User → NextAuth v5 (JWT strategy)
  ├── Credentials (email + password, bcrypt hashed)
  ├── Google OAuth
  ├── GitHub OAuth
  ├── Discord OAuth
  └── Wallet signature (EVM / Solana)

JWT → Edge Middleware → Route protection
  ├── Public routes: /, /info, /gate
  ├── Auth routes: /login, /register (redirect if logged in)
  └── Protected routes: /dashboard/*, /settings/*
```

### 7.2 Key Security Decisions
- **BYOK keys:** AES-256-GCM encrypted at rest, server-side only decryption
- **PayPal verification:** Timing-safe token comparison (prevents timing attacks)
- **Site Gate:** Cookie-based with base64 fingerprint, not plaintext password
- **CSRF:** Server actions use built-in Next.js CSRF protection
- **Rate limiting:** Per-user per-endpoint via middleware
- **Wallet verification:** Signature-based proof of ownership (no private key transmission)
- **Environment isolation:** Separate DB branches prevent dev data leaking to production

---

## 8. Data Model (Key Entities)

> The full Prisma schema is 2000+ lines. These are the unique/critical models.

```prisma
// User with progressive verification
model User {
  verificationTier    UserVerificationTier  @default(UNVERIFIED)
  trueReachScore      Float                 @default(0)
  wallets             Wallet[]
  apiKeys             UserApiKey[]          // BYOK
  dailyAiUsage        DailyAiUsage[]
}

// 14-tier enum
enum UserVerificationTier {
  ANONYMOUS UNVERIFIED EMAIL_VERIFIED WALLET_ONLY
  WEB2_BASIC WEB2_SOCIAL GOOGLE_VERIFIED MULTI_OAUTH
  WALLET_PLUS_SOCIAL PAYMENT_LINKED PAYMENT_VERIFIED
  PHONE_VERIFIED KYC_VERIFIED FULLY_VERIFIED
}

// Unified trade record (all 5 modes)
model TradeRecord {
  mode        TradeMode   // P2P | SELF | DEX | PAPER | LOCAL
  status      TradeStatus
  tokenIn     String
  tokenOut    String
  amountIn    Decimal
  amountOut   Decimal
  priceAtExec Decimal
  taxInfo     Json?       // Norwegian tax metadata
}

// Paper trading
model PaperPortfolio {
  userId    String   @unique
  cash      Decimal  @default(100000)
  holdings  Json     // { token: amount }[]
}

// Polls with 6 question types
model Poll {
  questions   PollQuestion[]
  responses   PollResponse[]
}

model PollQuestion {
  type    QuestionType  // SINGLE_CHOICE | MULTI_CHOICE | SLIDER | SCALE | TEXT | NESTED
  options Json?
  config  Json?         // min, max, step for SLIDER/SCALE
}

// BYOK encrypted keys
model UserApiKey {
  provider    AiProvider
  encryptedKey String    // AES-256-GCM
  isDefault   Boolean   @default(false)
}

// AI usage quota
model DailyAiUsage {
  userId String
  date   DateTime @db.Date
  count  Int      @default(0)
  @@unique([userId, date])
}

// Seller payment routing
model Product {
  receiverWalletId String?  // Level 1: product-specific
}

model Company {
  defaultReceivingWalletId String?  // Level 2: company default
}

// User already has defaultReceivingWalletId  // Level 3: user default
```

---

## 9. Implementation Sequence (Rebuild Order)

If rebuilding from scratch, follow this order to avoid circular dependencies:

### Phase 1: Foundation (Week 1-2)
1. **Scaffold Next.js app** — App Router, Tailwind, shadcn/ui
2. **Set up Prisma** — PostgreSQL on Neon, define User + Company + Product models
3. **Implement NextAuth v5** — Credentials + Google OAuth, JWT strategy, Edge middleware
4. **Build Site Gate** — Environment-based access control
5. **Create basic dashboard layout** — Floating dock sidebar

### Phase 2: Core Commerce (Week 3-4)
6. **Product CRUD** via server actions with Zod
7. **Company registration** with Brønnøysundregistrene integration
8. **Verification tier system** — Start with EMAIL_VERIFIED → GOOGLE_VERIFIED
9. **Seller payment routing** — Wallet + PayPal resolution chain
10. **Basic checkout flow** — Crypto + PayPal rails

### Phase 3: Social Layer (Week 5-6)
11. **Pulse Feed** — Posts, comments, reactions, real-time via Pusher
12. **True Reach tracking** — useReachTracker hook, behavioral data collection
13. **True Reach scoring** — 7-pillar calculation engine
14. **User profiles** with True Reach display

### Phase 4: Polls & AI (Week 7-8)
15. **Poll system** — 6 question types, builder, response collection
16. **Poll analytics** — 5-chart carousel, response quality scoring
17. **BYOK AI system** — Key management, provider resolution, quota tracking
18. **AI quiz generation** — SSE streaming pipeline
19. **Integrate polls with True Reach** — Engagement depth scoring

### Phase 5: Trading (Week 9-10)
20. **OSRS Inventory grid** — 4×7 slots, real wallet data
21. **OSRS Trade Window** — Dual grids, two-step accept
22. **Paper trading** — DB-simulated portfolio
23. **DEX integration** — 0x Swap API, KyberSwap
24. **Self-trade mode** — Between own wallets
25. **Norwegian tax compliance** — RF-1159 export, cost basis tracking

### Phase 6: Backend & Real-Time (Week 11-12)
26. **Hapi.js backend** — Shipping (Bring API), warehouse routes
27. **Socket.IO warehouse sync** — Bidirectional inventory updates
28. **Pusher integration** — Feed, trade, notification channels
29. **LocalDevTools panel** — Ganache chain manipulation

### Phase 7: Polish & Testing (Week 13-14)
30. **E2E test pyramid** — 5-layer single-file architecture
31. **Progressive verification** — Add remaining tiers (PHONE, KYC, FULLY_VERIFIED)
32. **Performance optimization** — Server Components, streaming, caching
33. **CI/CD pipeline** — GitHub Actions, Vercel + Railway deploy

---

## 10. Environment Variables Reference

```env
# Database (Neon PostgreSQL)
DATABASE_URL=                     # Local dev
DATABASE_URL_MAINPREVIEW=         # Vercel preview
DATABASE_URL_MAINLIVE=            # Vercel production

# Auth (NextAuth v5)
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# OAuth Providers
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=

# Web3
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_REOWN_PROJECT_ID=

# Real-time (Pusher)
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=

# AI (Platform keys for free tier)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
GROQ_API_KEY=
XAI_API_KEY=

# BYOK Encryption
BYOK_ENCRYPTION_KEY=              # AES-256-GCM key for user API keys

# File Uploads (EdgeStore)
EDGE_STORE_ACCESS_KEY=
EDGE_STORE_SECRET_KEY=

# Site Gate
SITE_MODE=                        # public | private
GATE_STATUS=                      # enabled | disabled
GATE_PASSWORD=                    # Password for /gate page

# Backend
BACKEND_URL=                      # http://localhost:3001
NEXT_PUBLIC_WS_URL=               # ws://localhost:3002

# Shipping (Bring API)
BRING_API_KEY=
BRING_API_UID=

# Norwegian Registry
# (uses public Brønnøysundregistrene API — no key needed)

# Blockchain (Local Dev)
# Ganache chains: 31337/:8545 and 1337/:7545
```

---

## 11. Success Metrics (How to Validate the Rebuild)

| Metric | Target | How to Verify |
|--------|--------|--------------|
| E2E tests pass | 93+ passed, 0 failed | Run `npx playwright test` |
| Type-check clean | Exit code 0 | Run `npx tsc --noEmit` |
| True Reach calculates | Score 0-100 for any content | Create post → interact → check score |
| Verification tiers work | Tier changes on OAuth link | Link Google → verify tier bumps |
| OSRS trade works | Two-step accept completes | Open trade → add items → accept x2 |
| Paper trading works | Buy/sell with virtual $100K | Execute paper trade → check portfolio |
| BYOK works | Custom key → unlimited AI | Add OpenAI key → chat → no quota hit |
| Polls work | 6 question types render | Create poll with each type → respond |
| Site gate blocks | Unauthenticated → /gate | Set SITE_MODE=private → visit / |
| Floating dock repositions | All 4 edges work | Move dock to each edge → content adjusts |
| Norwegian org lookup | Valid org → auto-fill | Enter "923 609 016" → company data appears |
| Tax export works | RF-1159 CSV downloads | Execute trades → export → validate format |
| Real-time works | Posts appear without refresh | Post in tab A → visible in tab B |

---

## 12. What This Document Does NOT Cover

This document captures **unique mechanisms and differentiators**. Standard features that any developer can implement from common patterns are not detailed here:
- Basic CRUD operations for products/users/companies
- Standard form validation patterns
- CSS/Tailwind styling specifics
- Standard OAuth implementation
- Generic database queries
- Standard deployment configuration

These are the **undifferentiated heavy lifting** that any modern framework handles. The value of VeggaStare is in the 15 unique mechanisms documented above — rebuild those, and you've rebuilt what makes this platform special.

---

## Execute Now Command

```
You are rebuilding VeggaStare (Freedom Store™) from this specification.
Read every section of REVIVAL_PROMPT.md carefully. Your job is to
reproduce every numbered mechanism in Section 3 (3.1 through 3.15),
following the implementation sequence in Section 9, using the tech
stack in Section 4. Validate each mechanism against the success
metrics in Section 11. Do not skip any anti-gaming mechanism,
formula, or interaction pattern — they are the product's moat.
Start with Phase 1. Ask clarifying questions before writing code
if any mechanism's behavior is ambiguous.
```
