
# Project Name: Dynamic Web Platform for Trading and Social Interaction

## Project Overview

This web application aims to revolutionize how users interact with each other, manage and trade company shares, crypto assets and engage in a community-driven marketplace. With a focus on secure authentication, dynamic user roles, and an interactive social platform, this project combines the efficiency of a trading platform with the connectivity of a social network.

### Core Features

- **Secure Authentication System**: Email/password login, email verification, Oauth and optional 2FA.
- **Role-Based Access Control (RBAC)**: Distinct user roles including superadmin, admin, moderator, user, and muted, with specific permissions.
- **User and Company Profiles**: Users can create, edit, and manage personal and company profiles, including detailed company information and share management.
- **Marketplace**: A platform for trading shares, games, codes, files, real-life products, and services.
- **Social Interaction**: Features include a global chat, a friend system, profile commenting, and encrypted messaging.
- **Company Management**: Share management, multi-signature actions, share splits, and company-wide messaging.

### Technical Stack

#### Frontend

- **Next.js 15** with TypeScript for SSR, SSG, and API routes
- **Tailwind CSS** for styling and **Next Themes** for theme management
- **Radix UI** components for accessibility and UI flexibility
- **React Hook Form** and **Zod** for form handling and validation
- **Framer Motion** for animations

#### Backend

- **Prisma Client** for ORM and database interactions
- **Next Auth** for authentication
- **Bcrypt** for password and sensitive data hashing

#### Development Tools

- **ESLint**, **TypeScript**, **PostCSS**, **Prisma** (schema migration and management)
- **Git** for version control, with **GitHub/GitLab** for repository hosting and collaboration

### Getting Started

1. **Clone the repository**: `git clone <repository-url>`
2. **Install dependencies**: `npm install`
3. **Setup the database**: Follow the instructions to configure your `.env` file for database connection.
4. **Run migrations**: `npx prisma migrate dev`
5. **Start the development server**: `npm run dev`

### Contributing

We welcome contributions from the community. Please read our contributing guide and submit pull requests to our repository.

### License

This project is licensed under the [MIT License](LICENSE.md) - see the file for details.

### Contact

For more information, please contact [Project Contact Information].
---

## True Reach™ - The 7 Pillars Metric System

VeggaStare's proprietary metric system for measuring authentic social impact and engagement quality.

### Overview

Unlike vanity metrics (follower counts, raw views), True Reach measures **actual value creation** through a 7-pillar framework inspired by:

- **OSI Model's 7 Layers** - Conceptual layering from physical to application
- **Brian Solis' 6 Pillars of Social Commerce** - Psychological engagement drivers (Social Proof, Authority, Scarcity, Liking, Consistency, Reciprocity)
- **Forbes' 6 Essential Pillars for Social Media Strategy** - Battle-tested agency tactics
- **6 Pillars of Killer Content** - Relevance, Truth, Passion, Humanity, Surprise, Originality

### The 7 Pillars (Stacked Multiplier Model)

Each layer compounds upon the one below it. This creates **exponential reach potential** when all layers are optimized.

| Layer | Pillar | Weight | Multiplier Effect | Description |
|-------|--------|--------|-------------------|-------------|
| 1 | **Foundation & Discovery** | 18% | Baseline | SEO, platform-native discoverability, SSR-optimized pages |
| 2 | **Killer Content** | 25% | 2–5× engagement | Relevance, authenticity, surprise factor, creator stories |
| 3 | **Psychological Drivers** | 18% | Trust + urgency | Solis 6 pillars: Social Proof, Scarcity, Authority, Liking |
| 4 | **Community & Belonging** | 14% | Retention + spread | Real relationships, wallet-gated channels, fan groups |
| 5 | **Amplification Tactics** | 10% | 5–20× impressions | Paid boosts, influencers, referral rewards, viral contests |
| 6 | **Analytics & Iteration** | 5% | Efficiency compound | Real-time data → fast pivots, Prisma + charts + SWR |
| 7 | **Realtime Pulse & Network Effects** | 10% | 10–100×+ exponential | Live drops, viral loops, Web3 flywheel, scheduled "Pulses" |

### The 7th Pillar: Realtime Pulse & Network Effects 🚀

**Definition:** A timed, high-intensity, multi-platform content/product release event ("Pulse") that is live, social, and incentivized, engineered to trigger network effects and self-sustaining virality.

**Key Mechanics:**
- **Pulse Scheduler** → Creators schedule drops with countdown timers
- **Universal Video Player** → YouTube, Twitch, Vimeo, HLS streams
- **Live Realtime Layer** → Live sales counter, buyer avatars, live chat, "Someone just bought X" notifications
- **Web3 Flywheel** → Auto-referral links, commission/NFT badges for sharing within first 30-60 min
- **Cross-platform Blast** → Auto-posts teaser + countdown to X, Instagram, TikTok, Telegram, Discord

**Realistic Outcomes (based on Friend.tech, Pump.fun, Gumroad live drops):**
- One well-executed Pulse → 30–150× normal daily reach in 2–4 hours
- Creates "I was there" FOMO → massive social proof
- Referral loop often turns 1 buyer into 4–12 new users

### User Verification Tiers

Views and poll responses are weighted by user verification level:

| Tier | Multiplier | Requirements |
|------|------------|--------------|
| Anonymous | 0.10x | Not logged in |
| Wallet Only | 0.30x | Web3 wallet connected, no verification |
| Web2 Basic | 0.40x | Email verified, no payment |
| Web3 Basic | 0.45x | Wallet + signed message |
| Social Basic | 0.50x | Discord/GitHub OAuth |
| Social Verified | 0.70x | Google OAuth |
| Multi-Social | 0.75x | 2+ OAuth providers (cross-verified) |
| Web2 Payment | 0.85x | Verified payment card |
| Web3 Verified | 0.90x | Google + verified wallet |
| Web3 Payment | 0.92x | Crypto purchase completed |
| Payment Verified | 0.95x | Web2 AND Web3 payment verified |
| Phone Verified | 1.00x | Phone number verified |
| Fully Verified | 1.20x | All verifications complete |

### Brian Solis' 6 Pillars Integration

| Pillar | Definition | VeggaStare Implementation |
|--------|------------|---------------------------|
| **Social Proof** | Behaviors guided by popularity cues | Top-seller rankings, user reviews, share counts, live buyer notifications |
| **Authority** | Trust in expert recommendations | Verified seller badges, creator verification, expert endorsements |
| **Scarcity** | Limited availability increases value | Limited editions, flash sales, countdown timers, "Only X left" |
| **Liking** | Preference for relatable entities | Peer recommendations, community features, relatable creator profiles |
| **Consistency** | Alignment with past behaviors | Repeat engagement rewards, familiar UI patterns, loyalty points |
| **Reciprocity** | Urge to repay favors | Free samples, referral rewards, community giveaways |

### Anti-Gaming Mechanisms

- **Dwell Time**: Minimum 500ms on-screen to count as view
- **Deduplication**: Per-user, per-content, 24-hour window
- **Burst Detection**: Flags sudden unnatural engagement spikes
- **Diminishing Returns**: Repeat views count 0.05x-0.2x
- **IP Fingerprinting**: Validates unique viewers
- **Verification Weighting**: Anonymous views worth 10% of fully verified

### Key Files

- `lib/view-strength.ts` - View strength calculation with verification tiers
- `lib/data/reach-audit-poll-questions.ts` - Community feedback poll questions
- `docs/REACH_7_PILLARS_SPECIFICATION.md` - Full technical specification

### Formula

```typescript
// Each pillar normalized to 0-100, then weighted
const trueReachScore = 
  (visibility * 0.18) +
  (engagementDepth * 0.25) +
  (conversionImpact * 0.18) +
  (loyalty * 0.14) +
  (growth * 0.10) +
  (recall * 0.05) +
  (velocity * 0.10);

// Then multiplied by verification tier for poll/view weighting
const weightedScore = trueReachScore * VERIFICATION_TIER_MULTIPLIERS[user.verificationTier];
```

---