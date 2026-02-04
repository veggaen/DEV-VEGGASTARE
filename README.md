
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
- **Brian Solis' 6 Pillars of Social Commerce** - Psychological engagement drivers
- **Forbes' 6 Essential Pillars for Social Media Strategy** - Battle-tested agency tactics

### The 7 Pillars

| # | Pillar | Weight | Description |
|---|--------|--------|-------------|
| 1 | **Visibility** | 18% | Unique exposures deduped across sessions |
| 2 | **Engagement Depth** | 25% | Quality interactions (saves, comments, dwell time) |
| 3 | **Conversion Impact** | 18% | Marketplace actions driven (clicks, purchases) |
| 4 | **Loyalty** | 14% | Repeat engagers who interact consistently |
| 5 | **Growth** | 10% | Organic expansion from posts |
| 6 | **Recall** | 5% | Predicted return rate and stickiness |
| 7 | **Velocity** | 10% | Realtime engagement momentum |

### User Verification Tiers

Views and poll responses are weighted by user verification level:

| Tier | Multiplier | Requirements |
|------|------------|--------------|
| Anonymous | 0.10x | Not logged in |
| Web2 Basic | 0.40x | Email verified |
| Social Verified | 0.70x | Google OAuth |
| Multi-Social | 0.75x | 2+ OAuth providers |
| Payment Verified | 0.95x | Web2 + Web3 payment |
| Fully Verified | 1.20x | All verifications |

### Anti-Gaming Mechanisms

- **Dwell Time**: Minimum 500ms on-screen to count
- **Deduplication**: Per-user, per-content, 24-hour window
- **Burst Detection**: Flags sudden engagement spikes
- **Diminishing Returns**: Repeat views count 0.05x-0.2x

### Key Files

- `lib/view-strength.ts` - View strength calculation
- `lib/data/reach-audit-poll-questions.ts` - Community feedback poll
- `docs/REACH_7_PILLARS_SPECIFICATION.md` - Full specification

### Formula

```typescript
const trueReachScore = 
  (visibility * 0.18) +
  (engagementDepth * 0.25) +
  (conversionImpact * 0.18) +
  (loyalty * 0.14) +
  (growth * 0.10) +
  (recall * 0.05) +
  (velocity * 0.10);
```

Each pillar is normalized to 0-100, resulting in a final score of 0-100.

---