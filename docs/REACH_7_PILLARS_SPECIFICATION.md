# The 7 Pillars of Reach™ - Complete Specification

> **Veggat True Reach Metric System**  
> Version 2.0 - The 7-Layer Architecture

---

## Table of Contents

1. [Overview](#overview)
2. [The 7 Pillars Framework](#the-7-pillars-framework)
3. [Verification Tier System](#verification-tier-system)
4. [Poll Power Calculation](#poll-power-calculation)
5. [Implementation Details](#implementation-details)
6. [Anti-Gaming Mechanisms](#anti-gaming-mechanisms)

---

## Overview

The Veggat Reach system is a **7-pillar metric framework** inspired by:

- **OSI Model's 7 Layers** - Conceptual layering from physical to application
- **Brian Solis' 6 Pillars of Social Commerce** - Psychological engagement drivers
- **Forbes' 6 Essential Pillars for Social Media Strategy** - Battle-tested agency tactics
- **Zenin Hive's 6 Pillars of Digital Marketing** - Measurable analytics focus
- **6 Pillars of Killer Content** - Relevance, Truth, Passion, Humanity, Surprise, Originality

### Why 7 Pillars?

Just as the OSI model provides 7 distinct layers for network communication, Veggat's Reach system now employs 7 distinct measurement layers that capture the full spectrum of social value creation.

---

## The 7 Pillars Framework

| # | Pillar | Weight | OSI Analogy | Key Metric |
|---|--------|--------|-------------|------------|
| 1 | **Visibility** | 18% | Physical Layer | Unique impressions |
| 2 | **Engagement Depth** | 25% | Data Link Layer | Quality interactions |
| 3 | **Conversion Impact** | 18% | Network Layer | Actions driven |
| 4 | **Loyalty** | 14% | Transport Layer | Repeat engagers |
| 5 | **Growth** | 10% | Session Layer | Organic expansion |
| 6 | **Recall** | 5% | Presentation Layer | Return rate |
| 7 | **Velocity** | 10% | Application Layer | Realtime momentum |

### Pillar 1: Visibility (18%)
**"The Physical Layer of Reach"**

```
Icon: 👁️ | Color: #10b981 (Emerald)
```

**What it measures:**
- Unique exposures deduped across sessions
- Actual distribution, not potential followers
- Platform-agnostic impression tracking

**Anti-gaming:**
- Requires ≥500ms on-screen time
- Dedupe per post/user/24h window
- IP fingerprint validation

**Formula:**
```
visibility = (uniqueViews × viewStrengthSum) / maxPossibleScore × 100
```

---

### Pillar 2: Engagement Depth (25%)
**"The Data Link Layer of Reach"**

```
Icon: 💬 | Color: #3b82f6 (Blue)
```

**What it measures:**
- Quality interactions beyond simple likes
- Saves, comments, dwell time, shares
- Meaningful signals that boost algorithmic push

**Anti-gaming:**
- Weight meaningful actions (comments > likes)
- Flag unnatural burst patterns
- Sentiment analysis on comments

**Formula:**
```
engagement = (comments×3 + saves×2 + shares×4 + dwellTime×0.5) / engagementCap × 100
```

---

### Pillar 3: Conversion Impact (18%)
**"The Network Layer of Reach"**

```
Icon: 🛒 | Color: #f59e0b (Amber)
```

**What it measures:**
- Marketplace actions driven (clicks, purchases)
- Profile visits converted to follows
- Content → Action pipeline effectiveness

**Anti-gaming:**
- Attribution via tracked referrals only
- Timeout short bounce sessions (<10s)
- Verify conversion completion

**Formula:**
```
conversion = (confirmedActions × actionValue) / exposures × 100
```

---

### Pillar 4: Loyalty (14%)
**"The Transport Layer of Reach"**

```
Icon: ❤️ | Color: #ec4899 (Pink)
```

**What it measures:**
- Repeat engagers who interact consistently
- True advocates vs. one-time visitors
- Reliable, end-to-end relationship quality

**Anti-gaming:**
- Dedupe bot accounts
- Require varied interaction types
- Minimum 3 distinct engagement sessions

**Formula:**
```
loyalty = (repeatEngagers × avgInteractionsPerUser) / totalAudience × 100
```

---

### Pillar 5: Growth (10%)
**"The Session Layer of Reach"**

```
Icon: 📈 | Color: #8b5cf6 (Violet)
```

**What it measures:**
- Organic expansion from posts
- New follows/visits from content
- How content escapes the existing follower graph

**Anti-gaming:**
- Attribute via timestamps
- Exclude self-visits
- Filter follow/unfollow manipulation

**Formula:**
```
growth = (newFollowers + newOrganicVisits) / previousAudienceSize × 100
```

---

### Pillar 6: Recall (5%)
**"The Presentation Layer of Reach"**

```
Icon: 🔄 | Color: #06b6d4 (Cyan)
```

**What it measures:**
- Predicted return rate and stickiness
- Forward-looking distribution estimate
- Content memorability and brand recognition

**Anti-gaming:**
- Server-side beacon for dwell tracking
- Dedupe return visits within 72h
- Cross-reference with engagement quality

**Formula:**
```
recall = (returnVisits × avgTimeOnReturn) / totalVisits × predictedReturnRate × 100
```

---

### Pillar 7: Velocity 🆕 (10%)
**"The Application Layer of Reach"**

```
Icon: ⚡ | Color: #ef4444 (Red)
```

**What it measures:**
- Realtime engagement velocity
- Viral momentum and trend acceleration
- Cross-network amplification
- Peak engagement timing patterns

**Components:**
1. **Engagement Velocity** - Rate of interactions over time
2. **Viral Coefficient** - How many new users each engagement brings
3. **Cross-Network Signals** - External shares/mentions
4. **Timing Optimization** - Peak hour performance

**Anti-gaming:**
- Coordinated burst detection
- Bot network identification
- Authentic spread verification

**Formula:**
```
velocity = (engagementRate / timeDelta) × viralCoefficient × crossNetworkBonus × 100
```

---

## Verification Tier System

Users are classified into verification tiers that affect their **view strength** and **poll power**:

> **Alignment note:** This table is an internal expanded tier map. Product-facing docs may describe a condensed 12-tier representation for UX communication.

| Tier | Multiplier | Description | Requirements |
|------|------------|-------------|--------------|
| `ANONYMOUS` | 0.10x | Not logged in | None |
| `WALLET_ONLY` | 0.30x | Web3 wallet only | Wallet connected |
| `WEB2_BASIC` | 0.40x | Email signup | Email verified |
| `WEB3_BASIC` | 0.45x | Wallet + signed message | Signature verified |
| `SOCIAL_BASIC` | 0.50x | Discord/GitHub OAuth | Single OAuth |
| `SOCIAL_VERIFIED` | 0.70x | Google OAuth | Google account |
| `MULTI_SOCIAL` | 0.75x | Multiple OAuth providers | 2+ OAuth linked |
| `WEB2_PAYMENT` | 0.85x | Payment card verified | Card on file |
| `WEB3_VERIFIED` | 0.90x | Google + verified wallet | Both linked |
| `WEB3_PAYMENT` | 0.92x | Crypto purchase made | On-chain tx |
| `PAYMENT_VERIFIED` | 0.95x | Web2 AND Web3 payment | Both payment types |
| `PHONE_VERIFIED` | 1.00x | Phone number verified | SMS verification |
| `FULLY_VERIFIED` | 1.20x | All verifications | Everything complete |

### Multi-OAuth Security Benefit

Multiple linked OAuth providers **increase** trust because:
- Each provider independently verifies the email
- An attacker would need to compromise multiple accounts
- Cross-verification proves consistent identity

---

## Poll Power Calculation

User poll responses are weighted by their verification tier:

```typescript
function calculatePollPower(user: User, pollConfig: PollConfig): number {
  // Base power from verification tier
  const tierPower = VERIFICATION_TIER_MULTIPLIERS[user.verificationTier];
  
  // Completion bonus (finished polls worth more)
  const completionMultiplier = pollResponse.isComplete ? 1.0 : 0.5;
  
  // Account age factor
  const ageBonus = user.accountAgeDays > 30 ? 1.1 : 1.0;
  
  // Engagement history bonus
  const engagementBonus = user.hasEngagedBefore ? 1.05 : 1.0;
  
  // Final poll power
  return tierPower * completionMultiplier * ageBonus * engagementBonus;
}
```

### Minimum Auth for Polls

Configurable via `POLL_MIN_AUTH_TIER` environment variable:

| Value | Minimum Tier | Use Case |
|-------|--------------|----------|
| `0` | ANONYMOUS | Public polls (low trust) |
| `1` | WEB2_BASIC | Email-verified users |
| `2` | SOCIAL_VERIFIED | Google OAuth required |
| `3` | PAYMENT_VERIFIED | Payment-verified only |

---

## Implementation Details

### View Strength Calculation

```typescript
// Final strength formula
strength = tierMultiplier × viewCountMultiplier × ipMultiplier × accountAgeMultiplier + interactionBonus

// Clamped to range [0.01, 2.0]
```

### View Count Diminishing Returns

| View # | Multiplier |
|--------|------------|
| 1st | 1.0x |
| 2nd | 0.2x |
| 3rd-5th | 0.1x |
| 6+ | 0.05x |

### IP Context Factors

| Context | Multiplier |
|---------|------------|
| New unique IP | 1.2x |
| Same IP, different user | 0.7x |
| Same IP, same user | 1.0x |

### Account Age Factors

| Age | Multiplier |
|-----|------------|
| < 7 days | 1.0x |
| 7-30 days | 1.05x |
| > 30 days | 1.1x |

---

## Anti-Gaming Mechanisms

### 1. View Deduplication
- Per-user, per-content, 24-hour window
- IP fingerprinting for anonymous users
- Session-based tracking

### 2. Burst Detection
- Flag sudden spikes in engagement
- Coordinated behavior analysis
- Rate limiting per user

### 3. Bot Prevention
- CAPTCHA challenges for suspicious patterns
- Device fingerprinting
- Behavioral analysis

### 4. Quality Signals
- Dwell time requirements (500ms minimum)
- Scroll depth tracking
- Interaction variety scoring

---

## True Reach Score Formula

The final True Reach Score combines all 7 pillars:

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

## Next Steps

1. **Implement Velocity pillar** in `lib/view-strength.ts`
2. **Update profile radar chart** for 7 pillars
3. **Create poll power middleware**
4. **Add velocity tracking hooks**
5. **Update analytics dashboard**

---

*Document Version: 2.0*  
*Last Updated: February 2026*  
*Author: Veggat Development Team*
