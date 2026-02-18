# Frontend — Veggat Web App

> Next.js 16 full-stack application powering the Veggat marketplace, social platform, and Web3 trading experience.

**URL:** [veggat.com](https://www.veggat.com) · **Dev:** [localhost:3000](http://localhost:3000)

---

## Quick Start

```bash
cd frontend
npm install
# Create .env.local manually using the Environment Variables section below
npx prisma generate                # Generate Prisma client
npx prisma migrate dev             # Apply database migrations
npm run dev                        # → http://localhost:3000
```

### Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev --webpack` | Dev server with Webpack |
| `build` | `next build --webpack` | Production build |
| `start` | `next start` | Serve production build |
| `lint` | `eslint .` | Lint the codebase |
| `clean` | Removes `.next/` | Clear build cache |
| `postinstall` | `prisma generate` | Auto-generate Prisma client |
| `seed:reach-poll` | `ts-node scripts/seed-reach-poll.ts` | Seed the Feedback & Discovery poll |

---

## Architecture

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (auth session, providers, theme)
│   ├── page.tsx            # Landing page
│   ├── (protected)/        # Auth-required routes
│   ├── auth/               # Login, register, verify, reset
│   ├── products/           # Product listings & detail pages
│   ├── companies/          # Company directory
│   ├── company/            # Company management dashboard
│   ├── dashboard/          # User dashboard
│   ├── warehouses/         # Warehouse management
│   ├── cart/               # Shopping cart
│   ├── checkout/           # Checkout flow
│   ├── order-confirmation/ # Post-purchase confirmation
│   ├── feed/               # Pulse social feed
│   ├── profile/            # User profiles
│   ├── pulse/              # Pulse event system
│   ├── poll-test/          # Poll development/testing
│   ├── analytics/          # Analytics dashboards
│   ├── gate/               # Access gating
│   ├── contact/            # Contact page
│   ├── info/               # Info pages
│   ├── privacy/            # Privacy policy
│   ├── terms/              # Terms of service
│   └── api/                # API routes (auth, uploads, etc.)
├── actions/                # Server actions
│   ├── login.ts / register.ts / logout.ts   # Auth
│   ├── products.ts / fetch-*.ts             # Product data
│   ├── create-company.ts / admin.ts         # Company management
│   ├── analytics-*.ts                       # Analytics queries
│   ├── fetchWarehouses.ts / updateWarehouse.ts  # Warehouse ops
│   └── settings.ts / security-action.ts     # User settings
├── components/
│   ├── ui/                 # shadcn/ui primitives (Button, Dialog, etc.)
│   ├── uicustom/           # Custom composite components
│   ├── header/             # Navigation header
│   ├── bars/               # Progress bars, toolbars
│   ├── crypto-related/     # Wallet, inventory, trading UI
│   └── providers/          # React context providers
├── contexts/
│   └── cart-context.tsx    # Shopping cart state
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, constants, helpers
├── prisma/
│   └── schema.prisma       # Database schema (2000+ lines)
├── generated/
│   └── prisma/             # Auto-generated Prisma client
├── schemas/                # Zod validation schemas
├── scripts/                # Seed scripts, utilities
├── public/                 # Static assets
├── e2e/                    # Playwright end-to-end tests
└── __tests__/              # Unit tests
```

---

## Tech Stack

| Category | Package | Version |
|----------|---------|---------|
| **Framework** | Next.js | 16.1.6 |
| **React** | React + React DOM | ^19.1.1 |
| **Auth** | NextAuth (v5 beta) | ^5.0.0-beta.7 |
| **Database** | Prisma Client | ^7.3.0 |
| **DB Adapter** | `@prisma/adapter-pg` + `pg` | ^7.3.0 / ^8.18.0 |
| **Styling** | Tailwind CSS | (config in app/globals.css with @theme) |
| **UI Library** | Radix UI (14+ primitives) | latest |
| **Icons** | Lucide React | ^0.563.0 |
| **Animations** | Framer Motion | ^11.0.5 |
| **Animations** | GSAP | ^3.14.2 |
| **Charts** | Chart.js + react-chartjs-2 | ^4.5.1 / ^5.3.1 |
| **Web3** | Reown AppKit + wagmi | ^1.8.17 / implicit |
| **Solana** | `@solana/web3.js` + wallet adapters | ^1.98.0 |
| **Realtime** | Pusher.js | ^8.4.0-rc2 |
| **File Upload** | EdgeStore | ^0.1.7 |
| **Forms** | React Hook Form + `@hookform/resolvers` | implicit |
| **Validation** | Zod | (via resolvers) |
| **Carousel** | Embla Carousel | ^8.0.0-rc22 |
| **Date** | date-fns | ^3.6.0 |
| **CLI/Search** | cmdk | ^1.1.1 |
| **Theme** | next-themes | ^0.2.1 |

---

## Key Features

### Marketplace
- Product listings with multi-image galleries, categories, filtering
- Company dashboards with employee management (OWNER / ADMIN / MEMBER roles)
- Warehouse inventory tracking with real-time sync via backend Socket.IO
- Bring/Posten shipping rate calculation and postal code lookup
- Full cart + checkout flow with order confirmation

### Web3 & Crypto
- **Wallet Connection** — Reown/WalletConnect AppKit, Coinbase Wallet, Phantom (Solana)
- **OSRS-Style Inventory** — Grid-based crypto asset management (drag-and-drop)
- **P2P Trading** — Trade windows with real-time offer/accept/decline, wallet signature confirmation
- **VeggaSystem Bot** — System account for automated platform operations
- **Chat-Lite Dropdown** — Inline conversation access from the trading interface

### Social (Pulse)
- Real-time feed with posts, reactions, and threaded conversations
- Direct messages, group chats, company announcements
- Follow/Sync system (one-way follow + mutual "sync")
- UserHoverCard with Follow→Sync + Trade buttons
- Trade notification system with purple blink indicator

### Polls & Analytics
- Advanced multi-question polls (slider, choice, text, image-paste, ranking, shape match, UI arrange, nested)
- Three poll types: SURVEY (open feedback), FEEDBACK (hybrid discovery), QUIZ (scored with correctness engine)
- Two-tier feedback disclosure: explanation → "Still don't understand?" → deepExplanation
- Verification-tier weighted responses (True Reach™ integration, 0.1x–1.2x)
- Anti-gaming: IP hashing, speed checks (2s min, 30/min max), straightline detection
- PollBuilder "Examples" dropdown with 6 templates (Verify Demo, Feedback & Discovery, Feature Explorer Quiz, Canna Coco Mastery, Quick Feedback, Product Preference)
- Analytics dashboards for companies, products, and users
- Chart.js radar/bar/line visualizations

### Auth & Verification
- NextAuth v5 with Google, GitHub, Discord OAuth providers
- Email magic link login
- Transactional emails via Resend (2FA, password reset, verification, security actions, wallet linked/unlinked)
- 12-tier verification system (0.10x → 1.20x multiplier)
- Web3 wallet signature verification

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | NextAuth secret key |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` in dev) |
| `GATE_PASSWORD` | Gate password used by `/gate` protection |
| `GATE_STATUS` | Gate toggle (`true` or `false`) |

### OAuth Providers

| Variable | Provider |
|----------|----------|
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | Discord OAuth |

OAuth callback URL requirements:
- Set `AUTH_URL` (or `NEXTAUTH_URL`) to your exact canonical host for each environment.
- GitHub callback URL: `<AUTH_URL>/api/auth/callback/github`
- Discord callback URL: `<AUTH_URL>/api/auth/callback/discord`
- A mismatch between provider callback URL and `AUTH_URL` causes `redirect_uri` errors.

### Web3

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Reown/WalletConnect project ID |

> **Tip:** Use separate Reown projects for dev vs prod. In the Reown dashboard, allowlist `http://localhost:3000` for dev and `https://www.veggat.com` for production.

### Email (Resend)

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key (starts with `re_`). Domain `veggat.com` must be verified in [Resend dashboard](https://resend.com). Used by `lib/mail.ts` for all transactional emails: 2FA codes, password reset, email verification, Web3 security actions, wallet link/unlink confirmations. |

### Realtime & Storage

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_PUSHER_KEY` | Pusher app key |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Pusher cluster |
| `EDGE_STORE_ACCESS_KEY` | EdgeStore access key |
| `EDGE_STORE_SECRET_KEY` | EdgeStore secret key |

### Backend Connection

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL (`http://localhost:3001`) |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (`http://localhost:3002`) |

---

## Database

The Prisma schema (`prisma/schema.prisma`) defines 2000+ lines of models including:

- **Users & Auth** — Account, User, Session, VerificationToken
- **Commerce** — Product, Category, Cart, CartItem, Order, Company, Employee, Warehouse
- **Social** — Conversation, Message, Follow, Friendship, FriendRequest, Reaction
- **Polls** — AdvancedPoll, PollQuestion, PollResponse, PollAnswer
- **Content** — Post, Comment, Notification
- **Web3** — Wallet verification, trade records

```bash
npx prisma generate      # Generate client
npx prisma migrate dev   # Apply migrations
npx prisma studio        # Visual data browser
```

---

## Deployment

Deployed on **Vercel**. Configuration in `vercel.json`.

- Uses Vercel's edge runtime for auth middleware (`auth-edge.config.ts`)
- Prisma Client generated at build time via `postinstall` script
- Static assets served from `public/`

---

## Connection to Backend

The frontend communicates with the standalone backend ([backend/README.md](../backend/README.md)) via:

1. **HTTP API** — Shipping rates, postal codes, health checks (`/v1/*`)
2. **Socket.IO** — Real-time warehouse inventory updates (port 3002)
3. **Pusher** — Receives events for notifications, trade updates, Pulse feed

> The backend is optional for basic development — the frontend has its own Prisma connection and API routes. The backend is required for shipping integration and real-time warehouse sync.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
