# Veggat

> **Modern marketplace for premium digital products and services.**

A full-stack Web3-enabled marketplace built with **Next.js 16**, **React 19**, and **TypeScript**. Features curated product listings, warehouse management, company dashboards, crypto P2P trading with OSRS-style inventory, social features (Pulse feed, conversations, follow/sync), an advanced poll system, and the proprietary **True Reach™** 7-pillar engagement metric.

**Live:** [veggat.com](https://www.veggat.com)

---

## Quick Links

| Resource | Description |
|----------|-------------|
| [frontend/README.md](frontend/README.md) | Frontend setup, features, env vars |
| [backend/README.md](backend/README.md) | Backend API, shipping integration, WebSocket |
| [docs/](docs/) | Detailed specs (7 Pillars, Polls, Social, Vipps) |
| [architecture.md](architecture.md) | System architecture & data flow |
| [prd.md](prd.md) | Product Requirements Document |
| [MasterContext.md](MasterContext.md) | Living context index for AI + dev onboarding |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 16.1.6 (Turbopack/Webpack), React 19, TypeScript, Tailwind CSS |
| **Auth** | NextAuth v5 (beta.7), Google/GitHub/Discord OAuth, email magic links |
| **Database** | PostgreSQL, Prisma 7.3.0 (with `@prisma/adapter-pg`) |
| **Backend** | Hapi.js 21 (standalone API on port 3001), Socket.IO 4 (port 3002) |
| **Web3** | Reown/WalletConnect (AppKit 1.8), wagmi 2, Solana wallet adapters |
| **Realtime** | Pusher (events + notifications), Socket.IO (warehouse sync) |
| **Email** | Resend (transactional emails from `veggat.com` domain) |
| **Storage** | EdgeStore (file uploads) |
| **Charts** | Chart.js 4 + react-chartjs-2, GSAP animations |
| **UI** | Radix UI primitives, shadcn/ui, Lucide icons, Framer Motion |
| **Deploy** | Vercel (frontend), Railway (backend) |

---

## Project Structure

```
DEV-VEGGASTARE/
├── frontend/           # Next.js 16 full-stack app (UI + API routes + Prisma)
│   ├── app/            # App Router pages & layouts
│   ├── actions/        # Server actions (auth, products, companies, analytics)
│   ├── components/     # UI components (Radix, shadcn, custom)
│   ├── prisma/         # Prisma schema (2000+ lines, PostgreSQL)
│   ├── lib/            # Utilities, helpers, constants
│   ├── hooks/          # React hooks
│   └── contexts/       # React contexts (cart, etc.)
├── backend/            # Hapi.js Integration Core
│   ├── src/            # Server, routes, integrations, WebSocket
│   ├── prisma/         # Backend Prisma schema
│   └── openapi/        # OpenAPI v1 spec (v1.yaml)
├── docs/               # Detailed specifications & plans
│   ├── REACH_7_PILLARS_SPECIFICATION.md
│   ├── POLL_SYSTEM_UPGRADE_MASTER_QUERY.md
│   ├── SOCIAL_FEATURES_PLAN.md
│   ├── VIPPS_REQUIREMENTS.md
│   └── integration-core.md
├── database-backups/   # PostgreSQL snapshots
├── architecture.md     # System architecture overview
├── prd.md              # Product requirements
└── MasterContext.md    # Aggregated project context
```

---

## Getting Started

### Prerequisites

- **Node.js** 20+ and **npm**
- **PostgreSQL** database (local or hosted)
- Environment variables configured (see sub-READMEs)

### Quick Start

```bash
# 1. Clone
git clone <repository-url>
cd DEV-VEGGASTARE

# 2. Frontend
cd frontend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev              # → http://localhost:3000

# 3. Backend (separate terminal)
cd backend
npm install
npm run dev              # → http://localhost:3001 (API) + :3002 (WebSocket)
```

> See [frontend/README.md](frontend/README.md) and [backend/README.md](backend/README.md) for full setup details including env vars.

---

## Core Features

### Marketplace & Commerce
- **Product Marketplace** — Browse, search, filter, purchase curated products with multi-image galleries
- **Company Management** — Company creation, employee roles & permissions (OWNER / ADMIN / MEMBER)
- **Warehouse System** — Multi-warehouse inventory tracking with real-time stock updates via WebSocket
- **Shipping Integration** — Bring/Posten live rates, postal code lookup, tracking (mock + live modes)
- **Cart & Checkout** — Full cart system with quantity management, currency display

### Web3 & Crypto Trading
- **Wallet Connection** — Reown/WalletConnect AppKit, Coinbase Wallet, Phantom (Solana)
- **OSRS-Style Inventory** — Drag-and-drop crypto inventory grid with item management
- **P2P Trading** — Real-time trade windows with offer/accept/decline flow, wallet confirmation on accept
- **VeggaSystem Bot** — Hardcoded system account for platform operations

### Social & Engagement
- **Pulse Feed** — Real-time social feed with posts, reactions, conversations (Pusher-powered)
- **Conversations** — Direct messages, group chats, employee broadcasts
- **Follow/Sync System** — One-way follows + mutual "sync" with UserHoverCard integration
- **Advanced Polls** — 3 types (Survey, Feedback, Quiz), 11 question types, PollBuilder with 5 templates, verification-weighted voting, two-tier quiz feedback engine
- **True Reach™** — 7-pillar engagement scoring (see below)

### Identity & Verification
- **12-Tier Verification** — From Anonymous (0.10x) to Fully Verified (1.20x) multiplier
- **Multi-OAuth** — Google, GitHub, Discord with cross-verification trust scoring
- **Web3 Verification** — Wallet signature + on-chain transaction verification

---

## True Reach™ — The 7 Pillars

| # | Pillar | Weight | What It Measures |
|---|--------|--------|------------------|
| 1 | **Visibility** | 18% | Unique impressions (deduplicated, 500ms min dwell) |
| 2 | **Engagement Depth** | 25% | Quality interactions (comments×3, saves×2, shares×4) |
| 3 | **Conversion Impact** | 18% | Content → Action pipeline (clicks, purchases) |
| 4 | **Loyalty** | 14% | Repeat engager consistency |
| 5 | **Growth** | 10% | Organic audience expansion |
| 6 | **Recall** | 5% | Return rate & stickiness |
| 7 | **Velocity** | 10% | Real-time engagement momentum & viral coefficient |

> Full specification: [docs/REACH_7_PILLARS_SPECIFICATION.md](docs/REACH_7_PILLARS_SPECIFICATION.md)

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| [docs/NORWAY_LEGAL_COMPLIANCE.md](docs/NORWAY_LEGAL_COMPLIANCE.md) | **Master compliance doc** — GDPR, consumer law, DSA, accessibility, DPI, payments, Web3, security |
| [docs/REACH_7_PILLARS_SPECIFICATION.md](docs/REACH_7_PILLARS_SPECIFICATION.md) | Complete True Reach™ metric spec with formulas, tiers, anti-gaming |
| [docs/POLL_SYSTEM_UPGRADE_MASTER_QUERY.md](docs/POLL_SYSTEM_UPGRADE_MASTER_QUERY.md) | Advanced poll system design, schema, UI components |
| [docs/SOCIAL_FEATURES_PLAN.md](docs/SOCIAL_FEATURES_PLAN.md) | Friends, followers, company chat, employee messaging |
| [docs/VIPPS_REQUIREMENTS.md](docs/VIPPS_REQUIREMENTS.md) | Vipps payment integration checklist |
| [docs/integration-core.md](docs/integration-core.md) | Backend Integration Core architecture rationale |

---

## License

This project is proprietary. All rights reserved.