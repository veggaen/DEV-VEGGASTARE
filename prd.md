# Product Requirements Document — Veggat

> Living PRD for the Veggat marketplace and social platform.

**Version:** 1.0  
**Last Updated:** 2026-02-14  
**Status:** Active Development

---

## 1. Vision

Veggat is a **modern, Web3-enabled marketplace** where users can buy and sell premium digital products, manage company inventories, engage in peer-to-peer crypto trading, and participate in a social platform with authentic engagement metrics.

The platform uniquely combines:
- Traditional e-commerce (products, companies, warehouses, shipping)
- Web3 capabilities (wallet-based identity, crypto trading, on-chain verification)
- Social engagement (Pulse feed, conversations, polls)
- Proprietary analytics (True Reach™ 7-pillar metric system)

---

## 2. Target Users

### 2.1 Buyers
- Browse and purchase curated digital products and services
- Track orders and manage shipping preferences
- Connect Web3 wallets for crypto-native features
- Participate in community polls and social features

### 2.2 Sellers / Companies
- Create and manage company profiles with employee roles
- List products with multi-image galleries and categories
- Manage multi-warehouse inventory with real-time tracking
- Access analytics dashboards for products, users, and engagement

### 2.3 Traders
- Connect wallets (Ethereum via WalletConnect, Solana via Phantom/Solflare)
- Manage crypto inventory using an OSRS-style grid interface
- Initiate P2P trades with wallet-verified confirmations
- Track trade history and partner reputation

### 2.4 Community Members
- Create posts and interact on the Pulse feed
- Follow/sync with other users
- Respond to advanced polls (slider, choice, text, nested questions)
- Build verification tier standing for weighted influence

---

## 3. Feature Areas

### 3.1 Marketplace & Commerce

| Feature | Status | Description |
|---------|--------|-------------|
| Product Listings | ✅ Shipped | Browse, search, filter products with images |
| Product Detail Pages | ✅ Shipped | Full product view with gallery, description, pricing |
| Category System | ✅ Shipped | Hierarchical product categorization |
| Shopping Cart | ✅ Shipped | Add/remove items, quantity management |
| Checkout Flow | ✅ Shipped | Address, shipping, payment flow |
| Order Confirmation | ✅ Shipped | Post-purchase confirmation page |
| Company Creation | ✅ Shipped | Register company with profile |
| Employee Management | ✅ Shipped | Invite, assign roles (OWNER/ADMIN/MEMBER), remove |
| Warehouse Management | ✅ Shipped | Create warehouses, manage stock per product |
| Real-time Stock Sync | ✅ Shipped | WebSocket-based inventory updates across clients |
| Shipping Integration | ✅ Shipped | Bring/Posten rates, postal code lookup, mock mode |
| Vipps Payment | ⏳ Planned | Norwegian mobile payment (see docs/VIPPS_REQUIREMENTS.md) |

### 3.2 Web3 & Crypto Trading

| Feature | Status | Description |
|---------|--------|-------------|
| Wallet Connection | ✅ Shipped | Reown/WalletConnect, Coinbase, Phantom, Solflare |
| OSRS-Style Inventory | ✅ Shipped | Grid-based crypto asset view with drag-and-drop |
| P2P Trade Windows | ✅ Shipped | Open trade, make offers, accept/decline |
| Wallet Confirmation | ✅ Shipped | Signature required on trade accept |
| Trade Notifications | ✅ Shipped | Purple blink indicator for incoming trades |
| Chat-Lite in Trade | ✅ Shipped | Inline conversation during trades |
| VeggaSystem Bot | ✅ Shipped | System account for automated operations |
| On-chain Verification | ✅ Shipped | Transaction-based tier upgrades |

### 3.3 Social & Engagement

| Feature | Status | Description |
|---------|--------|-------------|
| Pulse Feed | ✅ Shipped | Real-time social feed with posts, **client-side filter pagination fix** (multi-fetch loop for polls/pulses filter) |
| Reactions | ✅ Shipped | React to posts and content |
| Conversations (DM) | ✅ Shipped | Private direct messages |
| Group Conversations | ✅ Shipped | Multi-user group chats |
| Follow System | ✅ Shipped | One-way follow users |
| Sync System | ✅ Shipped | Mutual follow ("sync") relationship |
| UserHoverCard | ✅ Shipped | Hover preview with Follow/Sync + Trade buttons |
| Notifications | ✅ Shipped | Real-time notification system |
| Profile Editing | ⏳ Planned | Avatar, banner, bio editing in /settings |
| Friend Requests | ⏳ Planned | Two-way mutual friendship (see SOCIAL_FEATURES_PLAN) |
| User Search (Pulse) | ⏳ Planned | Search users at feed level |
| Company Customer Chat | ⏳ Planned | Live support widget on company profiles |
| Employee Broadcasts | ⏳ Planned | Company-wide announcement messaging |

### 3.4 Polls & True Reach™

| Feature | Status | Description |
|---------|--------|-------------|
| Basic Polls | ✅ Shipped | Single-question polls |
| Advanced Polls | ✅ Shipped | Multi-question (slider, choice, text, nested) |
| Image Paste in Polls | ✅ Shipped | Paste/upload images in poll answers |
| Verification Weighting | ✅ Shipped | Response power scaled by user tier |
| Fuzzy Text-Answer Matching | ✅ Shipped | Levenshtein + token-set + vowel-swap matching for TEXT quiz answers — typos like "algea" → "algae oil" are accepted |
| Streaming AI Generation | ✅ Shipped | SSE endpoint (`/api/polls/generate-stream`) with 6-step live progress UI in PollBuilder |
| Per-Question Trust Badges | ✅ Shipped | Colour-coded trust indicator per AI-generated question (High/Medium/Low) |
| Daily AI Quota Guard | ✅ Shipped | 5 free/day via auto-resolve (saved key > platform key). BYOK unlimited. No visible dropdown — clean UX with sleek `1/5` counter after first use |
| Conversational AI Chat | ✅ Shipped | Chat thread in PollBuilder: initial generation → Review Card → refinement loop ("make Q3 harder"). Groq default (Llama 3.3 70B), owner-only OpenAI, BYOK for Grok/Claude/OpenRouter |
| Interactive Preview | ✅ Shipped | PollTakerModal in preview mode: simulates full 5-screen quiz experience (welcome → sections → questions → completion → results) with no API calls, triggered from builder |
| 7 Example Templates | ✅ Shipped | 5 external templates (Verify Demo, Feedback & Discovery, Feature Explorer, Canna Coco, Tony Vegan+Eggs) + 2 inline (Quick Feedback 6Q, Product Preference 8Q) |
| Shape-Match Reliability | ✅ Shipped | Padded hit zones, proper swap logic, real-time drag hover feedback |
| True Reach™ Score | 🔄 In Progress | 7-pillar metric calculation |
| Velocity Pillar | ⏳ Planned | Real-time engagement momentum tracking |
| Radar Chart Profile | ⏳ Planned | 7-axis radar visualization per user |
| Poll Analytics | ⏳ Planned | Detailed poll result analytics dashboard |

### 3.5 Authentication & Verification

| Feature | Status | Description |
|---------|--------|-------------|
| Email/Password Auth | ✅ Shipped | With email verification |
| Google OAuth | ✅ Shipped | Via NextAuth v5 |
| GitHub OAuth | ✅ Shipped | Via NextAuth v5 |
| Discord OAuth | ✅ Shipped | Via NextAuth v5 |
| Email Magic Links | ✅ Shipped | Passwordless login |
| 12-Tier Verification | ✅ Shipped | Progressive identity verification |
| Two-Factor Auth | ⏳ Planned | TOTP-based 2FA |
| Phone Verification | ⏳ Planned | SMS-based identity verification |

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Initial page load under 3 seconds (Vercel Edge + SSR)
- Real-time events delivered within 500ms (Pusher)
- Stock updates reflected within 1 second (Socket.IO)

### 4.2 Security
- All mutations validated with Zod schemas
- CORS restricted in production
- Web3 transactions require wallet signature
- Anti-gaming: dwell time, deduplication, burst detection
- Environment-separated secrets (dev/prod)

### 4.3 Scalability
- Vercel serverless auto-scaling for frontend
- Railway container scaling for backend
- Pusher handles connection scaling
- PostgreSQL with Prisma connection pooling

### 4.4 Compliance
- Norwegian consumer law compliance for Vipps integration
- 14-day right of withdrawal (Angrerett)
- GDPR-aligned data handling
- Price display with VAT (MVA) included

---

## 5. Technical Constraints

| Constraint | Details |
|-----------|---------|
| **Next.js 16** | Using Webpack mode (`--webpack`) for build compatibility |
| **Prisma 7.3** | Using `@prisma/adapter-pg` driver adapter for serverless compatibility |
| **NextAuth beta** | v5.0.0-beta.7 — API may change before stable |
| **Bring API** | Requires customer number for some pricing; mock mode for development |
| **Reown AppKit** | WalletConnect v2 relay dependency |
| **Pusher** | Cloud-hosted; rate limits on free tier |

---

## 6. Roadmap

### Phase: Current (Q1 2026)
- Polish P2P trading experience
- Complete True Reach™ velocity pillar implementation
- Advance poll analytics dashboard

### Phase: Near-term
- Vipps payment integration (Norwegian market)
- Profile editing in /settings
- Friend request system (mutual friendships)
- Company customer chat (live support widget)
- User search at Pulse/feed level

### Phase: Future
- Mobile app (React Native or PWA)
- Additional shipping providers beyond Bring
- NFT marketplace integration
- Employee group messaging and broadcasts
- Cross-platform Pulse events (scheduled drops)

---

## 7. Reference Documents

| Document | Contents |
|----------|----------|
| [architecture.md](architecture.md) | System architecture, data flow, deployment |
| [docs/REACH_7_PILLARS_SPECIFICATION.md](docs/REACH_7_PILLARS_SPECIFICATION.md) | Complete True Reach™ metric specification |
| [docs/POLL_SYSTEM_UPGRADE_MASTER_QUERY.md](docs/POLL_SYSTEM_UPGRADE_MASTER_QUERY.md) | Advanced poll system design and schema |
| [docs/SOCIAL_FEATURES_PLAN.md](docs/SOCIAL_FEATURES_PLAN.md) | Social features implementation plan |
| [docs/VIPPS_REQUIREMENTS.md](docs/VIPPS_REQUIREMENTS.md) | Norwegian payment legal requirements |
| [docs/integration-core.md](docs/integration-core.md) | Backend architecture rationale |
| [MasterContext.md](MasterContext.md) | Aggregated project context |
