# VeggaToken — Token Economy & Legal Compliance Plan

> **Status:** Planning only — NO smart contract deployment, token minting, or financial operations without explicit founder approval.  
> **Author:** VeggaSystem agents + platform owner  
> **Created:** 2025-07  
> **Major Revision:** 2026-02 — MiCA integration, ENK→AS strategy, gamification engine, burn mechanics  
> **Reference:** [EVM-Contract-frontend](https://github.com/veggaen/EVM-Contract-frontend) (owner's previous EVM work)  
> **Cross-Reference:** [NORWAY_LEGAL_COMPLIANCE.md](NORWAY_LEGAL_COMPLIANCE.md) — comprehensive regulatory compliance map

---

## Table of Contents

1. [Vision & Philosophy](#1-vision--philosophy)
2. [Entity & Business Structure](#2-entity--business-structure)
3. [MiCA Classification & Token Legal Architecture](#3-mica-classification--token-legal-architecture)
4. [Token Specification](#4-token-specification)
5. [Supply Allocation](#5-supply-allocation)
6. [Action Pricing & Credit Economy](#6-action-pricing--credit-economy)
7. [Gamification Engine (REACH → XP → Credits → Tokens)](#7-gamification-engine)
8. [Burn & Deflation Mechanics](#8-burn--deflation-mechanics)
9. [Viral Loop & Referral System](#9-viral-loop--referral-system)
10. [Integrated Legal Compliance Plan](#10-integrated-legal-compliance-plan)
11. [Payment Flows](#11-payment-flows)
12. [Technical Architecture](#12-technical-architecture)
13. [Rollout Phases](#13-rollout-phases)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [Open Questions](#15-open-questions)

---

## 1. Vision & Philosophy

### 1.1 Mission

Launch a platform-native **ERC-20 utility token** ($VEGGA) that powers the VeggaStare ecosystem — poll/quiz creation, AI calls, Impact Quests, premium features — while staying fully compliant with Norwegian law and EU MiCA regulation.

### 1.2 Core Strategy: "Credits-First, Token-Later"

The defining legal and business strategy for VeggaStare:

1. **Phase A (NOW):** Platform runs on **internal credits** — no blockchain, no MiCA triggers, no VASP questions. Credits are database entries. The access gate stays closed (`GATE_STATUS=true`), password rotated regularly. No "offer to the public" exists.
2. **Phase B (After AS formation):** Credits become convertible to $VEGGA tokens on-chain. MiCA utility token exemptions apply. Gate opens for public launch.
3. **Phase C (Growth):** Full token economy with DEX liquidity, burn mechanics, and cross-chain features.

This phased approach means:
- **Zero regulatory risk** during development (gated beta ≠ public offer under MiCA Art. 12)
- **Limited liability** at launch (AS, not ENK, faces the public)
- **Proven product** before tokenization (users earn/spend credits first, understand the value)

### 1.3 Honest Context

This project is built by a **solo developer** from Norway with a day job in construction (tiling/bricklaying). The ENK (THORSEN SOFTWARE) was registered as a hobby/side project. The ambition is real, but resources are limited. Every decision in this plan is made with that reality in mind — we don't have investor money, we don't have a legal team on retainer, and we can't afford mistakes that trigger expensive regulatory processes prematurely.

### 1.4 REACH 7 Pillars as Foundation

The entire gamification and reward system is built on the existing **REACH scoring engine** ([REACH_7_PILLARS_SPECIFICATION.md](REACH_7_PILLARS_SPECIFICATION.md)):

| Pillar | Token Economy Role |
|--------|--------------------|
| **R**eliability | Streak multipliers — consistent users earn more |
| **E**ngagement | Core earning metric — quiz creation/completion, polls, Pulse posts |
| **A**uthenticity | Trust tier unlocks — verified users access premium features |
| **C**ommunity | Squad bonuses — collaborative earning, referral rewards |
| **H**elp | Impact Quests — environmental/social tasks, sponsor-funded rewards |
| **Influence** | Leaderboard position — top users get bonus multipliers |
| **Insight** | Content quality — well-received quizzes/polls earn more |

---

## 2. Entity & Business Structure

### 2.1 Current State

| Field | Value |
|-------|-------|
| **Entity** | THORSEN SOFTWARE |
| **Type** | Enkeltpersonforetak (ENK) — sole proprietorship |
| **Org.nr** | 937 051 107 |
| **Registered** | Brønnøysund Registersenteret |
| **Owner** | Personal liability — no separation between person and business |

### 2.2 The ENK Problem

An ENK **cannot** safely operate a public token economy because:

1. **Personal liability** — if anything goes wrong (user disputes, regulatory fines, smart contract bugs), the owner's personal assets are at risk. No limited liability protection.
2. **MiCA CASP restriction** — Article 59(3) of MiCA states that non-legal-person undertakings "shall only provide crypto-asset services if their legal form ensures a level of protection for third parties' interests equivalent to that afforded by legal persons." An ENK likely does not meet this standard.
3. **Investor/partner impossibility** — ENK cannot have shareholders, co-founders, or equity investment.
4. **Professional credibility** — Vipps, banks, and regulatory bodies take AS entities more seriously.

### 2.3 The Plan: AS Before Public Launch

**The access gate stays closed until an AS (Aksjeselskap) is formed.**

This is the single most important legal decision in this document. The gate system (`GATE_STATUS=true` in env vars, password via `GATE_PASSWORD`) ensures no public access during the ENK phase. Password is rotated regularly. Trusted testers get temporary access for feature validation.

### 2.4 AS Formation — Cost & Funding

| Cost Item | Amount (NOK) | Notes |
|-----------|-------------|-------|
| Aksjekapital (share capital) | 30,000 | **This is working capital** — not a fee. You can spend it on hosting, domain, Vipps fees, legal costs, etc. immediately after AS registration. It's your first business budget. |
| Brønnøysund registration fee | ~5,500 | One-time fee to Altinn/Brønnøysund |
| **Total needed** | **~35,500** | |

**There is no payment plan for the 30,000 NOK aksjekapital.** Brønnøysund requires the full amount deposited in a dedicated bank account before registration. However, once the AS is registered, the money is immediately usable as company working capital.

#### Funding Options (Ranked by Practicality)

| # | Option | Feasibility | Notes |
|---|--------|-------------|-------|
| 1 | **Day job savings** | ✅ Most realistic | Tiling/bricklaying income → save over months |
| 2 | **App pre-revenue** | 🔄 Possible | If beta testers generate any revenue via Vipps during gated testing |
| 3 | **Innovasjon Norge** | 🔄 Worth exploring | Etablerertilskudd or oppstartslån — check eligibility for tech/SaaS |
| 4 | **Municipal grants** | 🔄 Worth exploring | Some kommuner offer etablererstøtte for new businesses |
| 5 | **Personal microloan** | ⚠️ Last resort | Small loan to bridge the gap if close to target |
| 6 | ~~Crowdfunding~~ | ❌ **Avoid** | May trigger folkefinansieringsloven (LOV-2026-02-06-2) requirements |

### 2.5 AS Transition Triggers

Form the AS when **any ONE** of these becomes true:

| Trigger | Why |
|---------|-----|
| **30k+ saved and app is feature-complete** | Ready to launch publicly |
| **3-6 months of consistent test revenue** | Business viability proven |
| **Liability exposure grows** | B2B contracts, SLAs, payment disputes |
| **Need investors, co-founders, or employees** | ENK can't support this |
| **Crypto features require CASP registration** | Finanstilsynet requires legal person |

### 2.6 AS Formation Steps

1. Save 35,500 NOK (30k aksjekapital + registration fee)
2. Open a dedicated bank account for the AS
3. Deposit 30,000 NOK aksjekapital
4. Register via Altinn → Samordnet registermelding for AS
5. Receive org.nr for the new AS
6. Transfer all assets from ENK to AS (domain, repositories, brand, Vipps agreement)
7. Update all legal pages (`/terms`, `/privacy`, `/info`) with new AS org.nr and entity name
8. Update footer, email templates, and any hardcoded references
9. Set `GATE_STATUS=false` → **public launch**

### 2.7 Pre-AS Prep Checklist (Do Now While ENK)

- [ ] Separate business bank account (even for ENK — cleaner bookkeeping)
- [ ] Clean asset ownership — domain, repos, brand accounts all clearly under your control
- [ ] Proper bookkeeping habits (Fiken, Tripletex, or similar)
- [ ] Invoice/receipt discipline for all business expenses
- [ ] Skatteetaten reporting awareness (næringsoppgave, MVA threshold at 50k NOK)
- [ ] Vipps business agreement application pending (requires org.nr — ENK has this)
- [ ] Document all pre-AS development costs (deductible when AS is formed if structured correctly)

---

## 3. MiCA Classification & Token Legal Architecture

### 3.1 $VEGGA Token Classification

Under MiCA (EU Regulation 2023/1114), crypto-assets are classified into three categories:

| Category | Definition | $VEGGA? |
|----------|-----------|---------|
| **E-money token (EMT)** | References one official currency at par value | ❌ No — $VEGGA is not pegged to any fiat |
| **Asset-referenced token (ART)** | Stabilizes value by referencing other assets | ❌ No — $VEGGA has no reserve/peg |
| **Other crypto-asset** | Everything else, including utility tokens | ✅ **Yes** |

**$VEGGA is a utility token** per MiCA Article 3(1)(9):

> *"'utility token' means a type of crypto-asset that is only intended to provide access to a good or a service supplied by its issuer"*

$VEGGA provides access to: quiz/poll creation, AI generation calls, premium question types, featured placement, analytics export, squad formation, Impact Quest participation, and other platform services.

### 3.2 Why $VEGGA is NOT a Financial Instrument

Critical to document — if $VEGGA were classified as a financial instrument, it falls outside MiCA and into MiFID II (much heavier regulation). $VEGGA avoids this because:

- **No profit-sharing** — holding $VEGGA does not entitle holders to platform revenue or dividends
- **No governance votes with financial returns** — no DAO treasury control, no fee distribution votes
- **Pure utility access** — every token function maps to a concrete platform service
- **No investment promise** — marketing must say "platform credits", never "investment opportunity"
- **No staking rewards from protocol revenue** — any staking is purely for platform feature access

### 3.3 MiCA Exemption Pathways

While the gate is closed, there is **no "offer to the public"** at all (MiCA Art. 12 defines this as "a communication to persons in any form... presenting sufficient information on the terms of the offer"). A password-gated private beta with rotating access does not constitute this.

After public launch (post-AS), these exemptions may apply:

| Exemption | MiCA Article | Applicability |
|-----------|-------------|---------------|
| **Utility token for existing service** | Art. 4(3)(c) | ✅ If $VEGGA provides access to services that already exist and are operational at launch |
| **Offer <EUR 1,000,000** | Art. 4(2)(b) | ✅ Total consideration under €1M over 12 months — highly likely for initial period |
| **Offer to <150 persons per Member State** | Art. 4(2)(a) | ✅ Initially, user base will be small |
| **Tokens offered for free** | Art. 4(3)(a) | ✅ Earned tokens (rewards) are free — no consideration paid |

**Important:** Even with exemptions, Norwegian consumer protection laws (Forbrukerkjøpsloven, Digitalytelsesloven, Angrerettloven) still apply per MiCA Recital 29.

### 3.4 White Paper Strategy: Prepare Regardless

Even if exemptions apply, we will **prepare a MiCA-compliant crypto-asset white paper** (Annex I format) as a "belt and suspenders" approach:

- Demonstrates good faith to Finanstilsynet
- Required if we exceed exemption thresholds (>€1M or >150 holders per Member State)
- Contains required environmental disclosure (Annex I Part J) — PulseChain uses Proof-of-Stake, energy-efficient
- Includes mandatory warnings (Art. 6(5)): "may lose value", "may not be transferable", "may not be liquid", "not covered by investor compensation or deposit guarantee schemes"

### 3.5 ENK Cannot Be CASP

MiCA Article 59(1) requires crypto-asset service providers to be:
> *(a) a legal person... that has been authorised as crypto-asset service provider*

Article 59(3) allows non-legal-person undertakings only if their legal form "ensures a level of protection for third parties' interests equivalent to that afforded by legal persons."

**An ENK does not meet this standard.** This reinforces:
- Form AS before any crypto-asset services go live
- During ENK phase: credits only, no on-chain token operations
- "Never hold funds" principle is critical regardless (see §10.8)

If the AS ever needs CASP authorization, minimum capital requirements (MiCA Annex IV):

| CASP Class | Services | Minimum Capital |
|------------|----------|----------------|
| Class 1 | Custody, transfer services | EUR 50,000 |
| Class 2 | Class 1 + exchange, placement | EUR 125,000 |
| Class 3 | Class 2 + trading platform operation | EUR 150,000 |

---

## 4. Token Specification

### 4.1 Contract Details

| Field | Value |
|-------|-------|
| **Name** | VeggaToken |
| **Symbol** | VEGGA |
| **Standard** | ERC-20 (OpenZeppelin v5) |
| **Primary Network** | PulseChain (chainId: 369) — Proof-of-Stake, low fees, HEX ecosystem |
| **Secondary Network** | Ethereum Mainnet (chainId: 1) — credibility, Uniswap liquidity |
| **Decimals** | 18 |
| **Total Supply** | 100,000,000 (100M) — fixed at deployment |
| **Owner** | VeggaSystem wallet (`0x018F6bF56814Dfa2543f98041e44A202b3632636`) |
| **License** | MIT |

### 4.2 Contract Features

```solidity
// Minimal ERC-20 — no owner privileges beyond emergency pause
// Based on OpenZeppelin ERC20 + ERC20Permit + Ownable + Pausable

- Standard transfer/approve/transferFrom
- EIP-2612 permit() for gasless approvals (Uniswap/PulseX interactions)
- Ownable — owner can pause in emergency (smart contract bug, exploit)
- Pausable — temporary halt of all transfers if needed
- No mint() — supply fixed at 100M at deployment
- No blacklist — censorship-resistant
- No tax/fee on transfer — clean token
```

### 4.3 Multi-Chain Deployment

| Chain | Role | DEX |
|-------|------|-----|
| **PulseChain (369)** | Primary — low fees, PoS, existing HEX community | PulseX |
| **Ethereum (1)** | Secondary — credibility, institutional access | Uniswap V3 |

Bridge mechanism: LayerZero OFT (Omnichain Fungible Token) standard, or manual bridge contract. Evaluated during Phase 2.

### 4.4 Environmental Disclosure (MiCA Annex I Part J)

Required by MiCA for the white paper:
- **Consensus mechanism:** PulseChain uses Proof-of-Stake (delegated validators)
- **Energy consumption:** Minimal — PoS does not require mining hardware
- **Carbon footprint:** Negligible compared to Proof-of-Work chains
- **Ethereum:** Also Proof-of-Stake since The Merge (September 2022)

Both deployment chains are PoS — strong compliance posture for environmental disclosure.

---

## 5. Supply Allocation

### 5.1 Distribution (Community-Heavy)

| Allocation | Amount | % | Lock / Vesting | Purpose |
|------------|--------|---|---------------|---------|
| **Community Rewards** | 25,000,000 | 25% | Linear release over 36 months | Earned via REACH actions, quests, streaks |
| **Impact Pool** | 25,000,000 | 25% | Released per quest campaign | Sponsor-funded matching for environmental/social quests |
| **Treasury** | 25,000,000 | 25% | Unlocked (AS working capital) | Platform operations, development, hosting, legal fees |
| **Founder** | 5,000,000 | 5% | 2-year cliff, 4-year linear vest | Solo dev allocation — intentionally small, honest |
| **Liquidity** | 10,000,000 | 10% | Locked in LP (12-month minimum) | DEX pools: PulseX + Uniswap V3 |
| **Advisors & Legal** | 5,000,000 | 5% | 1-year cliff, 2-year vest | MiCA compliance costs, legal counsel, Finanstilsynet fees |
| **Emergency Reserve** | 5,000,000 | 5% | Locked 12 months, then multisig | Smart contract insurance, bug bounties, unforeseen compliance |

**Total: 100,000,000 (100%)**

### 5.2 Design Rationale

- **75% community/impact/treasury** — this is a social platform, not a team enrichment vehicle
- **5% founder** — honest allocation for a solo dev. Standard for crypto is 15-20%, but we're building trust
- **25% Impact Pool** — the differentiator. Sponsors fund real-world impact quests, tokens match contributions
- **10% liquidity** — sufficient for initial DEX pools without overexposing the treasury

---

## 6. Action Pricing & Credit Economy

### 6.1 Core Model: 1 Credit = 1 Action Unit

Users interact with the platform using **credits** (Phase 0-1) which later become convertible to $VEGGA tokens (Phase 3+). The credit→token conversion rate is defined at token launch, not before.

### 6.2 Spending (Credit Sinks)

| Action | Cost (Credits) | Notes |
|--------|---------------|-------|
| Take a quiz | 0 | Always free for takers |
| Create a poll/quiz | 1 | Deducted at publish |
| AI generate quiz (Groq) | 2 | Covers AI inference cost |
| AI generate with own key (BYOK) | 0 | Uses their API credit |
| Premium question types | +1 each | Shape-match, REACH assessment |
| Feature a poll (pin to top) | 5 | Pins to Pulse feed top |
| Boost poll reach | 10-50 | Amplified distribution |
| Export analytics (CSV/PDF) | 3 | Data export |
| P2P trade listing | 1 | Per trade posted |
| **Squad formation** | 10 | One-time cost to create a squad |
| **Squad upgrade** (tier up) | 25 | Unlock squad perks |
| **Premium badge frame** | 5 | Cosmetic badge customization |
| **Impact Quest entry (premium tier)** | 3 | Access to sponsor-funded quests |

### 6.3 Earning (Credit Sources)

| Activity | Reward (Credits) | Cap | REACH Pillar |
|----------|-----------------|-----|-------------|
| Complete a quiz (score >80%) | 0.2 | 5/day | Engagement |
| Create a quiz taken by 10+ people | 1 | No cap | Engagement, Insight |
| Streak (7 consecutive days active) | 2 | Weekly | Reliability |
| Refer a user (verified signup) | 5 | 20/month | Community |
| Report a bug (confirmed) | 10 | Per bug | Help |
| Complete Impact Quest | 5-50 | Per quest | Help |
| Squad weekly challenge completion | 3 | Weekly | Community |
| Top 10 leaderboard (weekly) | 5 | Weekly | Influence |
| Content quality bonus (>4.5★ avg) | 2 | Per qualifying quiz | Insight |
| **Free tier** | 5 actions/day | Daily | — |

### 6.4 Credit→Token Conversion (Phase 3+ Only)

- Conversion rate set at token launch (e.g., 100 credits = 1 VEGGA)
- One-way: credits → tokens (not tokens → credits, to prevent arbitrage)
- Requires verified account (REACH Authenticity pillar score >50)
- AS must be formed before conversion is enabled
- All conversions logged for DPI reporting and tax purposes

---

## 7. Gamification Engine

### 7.1 Pipeline: REACH → XP → Credits → Tokens

```
                                                     ┌──────────────┐
  7 Pillars of REACH  ──►  XP Points  ──►  Credits  ──►  $VEGGA     │
  (scoring engine)        (earned)        (spendable)   (on-chain)   │
                                                     │  Phase 3+     │
                                                     └──────────────┘
```

**XP is earned** through REACH-aligned actions. XP translates to credits at a defined rate. Credits translate to tokens only after AS formation + token launch.

### 7.2 Badge System

| Badge Tier | XP Threshold (per pillar) | Perk |
|------------|--------------------------|------|
| 🥉 Bronze | 100 XP | Badge displayed on profile |
| 🥈 Silver | 500 XP | 1.1x credit earning multiplier |
| 🥇 Gold | 2,000 XP | 1.25x multiplier + custom badge frame |
| 💎 Diamond | 10,000 XP | 1.5x multiplier + verified creator status + early access to features |

Badges are **per pillar** — a user can be Diamond in Engagement but Bronze in Community. This encourages well-rounded participation.

### 7.3 Streak System

| Streak Length | Multiplier | Bonus |
|---------------|-----------|-------|
| 3 days | 1.1x | — |
| 7 days | 1.25x | +2 bonus credits |
| 14 days | 1.4x | +5 bonus credits |
| 30 days | 1.5x | +10 bonus credits + streak badge |
| 90 days | 1.75x | +25 bonus credits + "Dedicated" title |
| 365 days | 2.0x | +100 bonus credits + "OG" title + permanent 2x |

**Streak breaks:** Missing a day resets to 0. Streak Shields (purchasable with credits) protect one missed day per month.

### 7.4 Leaderboard System

| Scope | Reset Cycle | Top Reward |
|-------|-------------|-----------|
| Squad (3-7 members) | Weekly | Squad treasury bonus |
| City (by user location) | Monthly | City champion badge |
| National (Norway first) | Monthly | Featured on Pulse feed |
| Global | Quarterly | Bonus token allocation from Community Rewards pool |

**Time-decay scoring:** Recent activity weighs more than historical activity (prevents stale leaderboard positions). Formula: `score = Σ(action_xp × decay^days_ago)` where decay = 0.97.

### 7.5 Squad System

- **Formation:** 3-7 members, costs 10 credits to create
- **Combined REACH:** Squad score = average of member REACH scores
- **Squad Treasury:** Collective burns and quest earnings fund squad perks
- **Squad Challenges:** Weekly group objectives (e.g., "complete 50 quizzes as a squad")
- **Squad Tiers:** Bronze → Silver → Gold (based on collective XP, with upgrade costs)

### 7.6 Impact Quests

Time-limited tasks that combine real-world action with platform verification:

| Quest Type | Example | Verification | Reward |
|------------|---------|-------------|--------|
| Environmental | Beach cleanup photo | AI image analysis + GPS location | 20-50 credits |
| Community | Organize local quiz night | Event photo + 5+ participant signups | 30 credits |
| Educational | Complete a learning path | Quiz scores >90% across a series | 15 credits |
| Creative | Design a quiz template | Community vote (>4★ average) | 10 credits |
| Social Impact | Donate to verified cause | Receipt/confirmation upload | 25 credits + sponsor match from Impact Pool |

**Sponsor-funded quests:** Businesses can sponsor Impact Quests, funding rewards from the Impact Pool. This creates a B2B revenue stream that doesn't require users to pay.

---

## 8. Burn & Deflation Mechanics

### 8.1 Burn Sources

| Source | Rate | Trigger |
|--------|------|---------|
| **Platform revenue share** | 10% of Vipps checkout fees | Quarterly buy-and-burn |
| **Premium feature unlocks** | 100% of credit cost | Credits consumed permanently |
| **Squad formation/upgrades** | 100% of cost | Tokens burned on-chain |
| **Expired unclaimed rewards** | 100% after 90 days | Uncollected quest/streak rewards |
| **Streak Shield purchase** | 100% of cost | Burned on purchase |

### 8.2 Burn Mechanics

- **Quarterly burns:** Platform collects revenue in NOK (via Vipps). 10% is used to buy $VEGGA on PulseX/Uniswap → sent to burn address (`0x000...dead`). Publicly verifiable on-chain.
- **Activity burns:** When users spend credits on premium features, those credits are permanently removed from circulation (not returned to treasury).
- **On-chain burns:** Squad operations and Streak Shield purchases burn actual tokens once the token is live.

### 8.3 Legal Note on Burns

MiCA Article 6(1)(f) requires the white paper to disclose "the rights and obligations attached to the crypto-asset" including supply modification mechanisms. All burn mechanics must be documented in the white paper before token launch.

### 8.4 Burn Dashboard (Admin Panel)

- Real-time circulating supply counter
- Total burned (cumulative)
- Burn history with tx hashes (on-chain) and timestamps (off-chain credits)
- Projected future burns based on revenue trends
- Public-facing burn counter on platform (transparency)

---

## 9. Viral Loop & Referral System

### 9.1 Referral Mechanism

- Each user gets a unique referral code (e.g., `veggastare.com/r/USERNAME`)
- Inviter receives **10% of invitee's earned credits** for the first 30 days
- Invitee receives **5 bonus credits** on signup completion
- Cap: 20 referral rewards per month (prevents gaming)
- Referral rewards only become tokens when both parties have verified accounts

### 9.2 OG Share Cards

Rich social media preview cards generated via Next.js OG Image API:

- **Profile cards:** Show username, REACH score, top badges, streak length
- **Quiz cards:** Show quiz title, participant count, pass rate
- **Achievement cards:** "I just earned Diamond in Engagement on VeggaStare!"
- **Squad cards:** Squad name, combined stats, leaderboard position

Cards include QR code linking to the user's profile or quiz.

### 9.3 Impact Story Posts

Auto-generated shareable content when users complete notable actions:
- "🌊 I just completed a beach cleanup Quest and earned 50 credits on VeggaStare"
- "🔥 30-day streak! My REACH score is now 847"
- "🏆 Our squad [SquadName] just hit Gold tier!"

Users opt-in to auto-posting on the Pulse feed. External sharing to X/Instagram earns +1 bonus XP (Community pillar).

### 9.4 Activation Timing

All viral features activate at **public launch only** (Phase 3, post-AS). During gated beta:
- Referral codes are generated but not rewardable
- Share cards are generated but watermarked "Beta"
- No external sharing incentives

---

## 10. Integrated Legal Compliance Plan

This section is the legal backbone of the token economy. Cross-reference with [NORWAY_LEGAL_COMPLIANCE.md](NORWAY_LEGAL_COMPLIANCE.md) for the broader platform compliance map.

### 10.1 Pre-Launch Phase (Gated, ENK) — Current

| Obligation | Status | Priority | Notes |
|-----------|--------|----------|-------|
| **MiCA compliance** | ✅ Not triggered | — | Gate closed → no "offer to the public" per Art. 12 |
| **Consumer protection** | ✅ Not triggered | — | No public B2C transactions while gated |
| **VASP registration** | ✅ Not triggered | — | No crypto services while ENK, credits only |
| **DPI reporting** | ✅ Not triggered | — | No public marketplace transactions while gated |
| **GDPR / Privacy policy** | ❌ **BLOCKER** | 🔴 Critical | Even gated testers are data subjects. `/privacy` must be rewritten per Art. 13/14. See [NORWAY_LEGAL_COMPLIANCE.md §3](NORWAY_LEGAL_COMPLIANCE.md) |
| **Bookkeeping** | ⚠️ Ongoing | Medium | Track all dev expenses for future AS deduction |
| **MVA threshold** | ⚠️ Monitor | Low | Register when taxable turnover exceeds 50,000 NOK in 12 months |

**Key insight:** The gated beta is a powerful legal shield. Almost all regulatory obligations activate at "public launch" or "offer to the public." The one exception is GDPR — it applies whenever you process anyone's personal data, even one tester.

### 10.2 Launch Day (AS Formed, Gate Opens)

When `GATE_STATUS=false`:

| Obligation | Trigger | Action Required |
|-----------|---------|----------------|
| **Ehandelsloven** | Public e-commerce | Seller identification, terms accessibility, order confirmations |
| **Forbrukerkjøpsloven** | Consumer product sales | Warranties, complaint rights, refund flow |
| **Angrerettloven** | Distance sales to consumers | 14-day withdrawal right, Angrerettskjema available |
| **Digitalytelsesloven** | Digital services (SaaS, credits) | Conformity, updates, consumer rights for digital content |
| **DSA (via Nkom)** | UGC platform | Content reporting system, moderation transparency |
| **DPI reporting** | Marketplace sales | Seller reporting to Skatteetaten (XML format) |
| **Accessibility (WCAG)** | Public-facing website | WCAG 2.1 AA + accessibility statement |
| **Cookie compliance** | Public visitors | Detailed cookie list + third-party disclosure |

All of these must be in place **before** the gate opens. This is the compliance checklist for Phase 3.

### 10.3 Token Launch Phase (Post-AS)

| Obligation | Trigger | Action Required |
|-----------|---------|----------------|
| **MiCA white paper** | Token offered publicly (if exemptions don't apply) | Prepare Annex I format white paper — even if exempt, have it ready |
| **Finanstilsynet notification** | Token launch | Informal pre-consultation, then formal notification with white paper |
| **MiCA Art. 14 duties** | Offering tokens | Act honestly/fairly/professionally, no conflicts of interest |
| **AML/KYC** | If VASP registration needed | Know Your Customer for credit→token conversion |
| **Tax reporting** | Token transactions | Provide Skatteetaten-compatible transaction exports for users |

### 10.4 VASP Registration Analysis

**"Never Hold Funds" Strategy:**

If VeggaStare **never custodies** crypto or fiat:
- Vipps handles all fiat payments (Vipps is a licensed PSP)
- Users hold their own wallets (MetaMask, Phantom via wagmi/Solana adapters)
- Platform records transactions but never holds assets
- Credit→token conversion: user receives tokens directly to their connected wallet

**This may eliminate the VASP registration requirement entirely.** But it needs legal confirmation (see Open Questions §15).

If VASP registration IS required:
- Triggers AS formation as prerequisite (ENK cannot be CASP)
- AML/KYC requirements: identity verification for all token operations
- Registration with Finanstilsynet under hvitvaskingsloven (AML Act)
- Ongoing reporting obligations

### 10.5 DPI Reporting (DAC8)

Effective 1 January 2026 in Norway. During gated beta: **no obligation** (no public marketplace transactions).

At public launch, if the marketplace facilitates sales of goods:
- Report seller information to Skatteetaten
- Track: name, address, tax ID, total consideration, platform fees, transaction count
- Export in Skatteetaten's required XML format
- Monitor threshold triggers

*Note: The DPI deadline has technically passed (Jan 2026), but since the gate is closed and no reportable transactions have occurred, there is no reporting obligation. DPI pipeline must be ready before gate opens.*

Cross-reference: [NORWAY_LEGAL_COMPLIANCE.md §11](NORWAY_LEGAL_COMPLIANCE.md)

### 10.6 Consumer Protection for Credits & Tokens

Norwegian consumer protection laws apply to credit/token purchases:

| Law | Implication for Token Economy |
|-----|------------------------------|
| **Forbrukerkjøpsloven** | Credits/tokens purchased for fiat = consumer purchase with warranty/complaint rights |
| **Digitalytelsesloven** | Credits providing access to digital services = digital content, 14-day withdrawal may apply |
| **Angrerettloven** | Right of withdrawal for distance sales — except for "digital content not supplied on tangible medium" if consumer gives *explicit* prior consent + acknowledges losing withdrawal right |
| **Markedsføringsloven** | All marketing must be fair, clear, not misleading. No investment claims. |

**Key implementation:** At purchase, user must explicitly consent: "I agree that [credit/token] delivery begins immediately and I understand I lose my right of withdrawal" (Angrerettloven §22(m) exception for digital content).

### 10.7 folkefinansieringsloven (LOV-2026-02-06-2)

New Norwegian crowdfunding regulation effective February 2026. Evaluate:
- **Credits earned for free:** ✅ Safe — no "consideration" means no crowdfunding trigger
- **Credits purchased with fiat:** ⚠️ Depends on framing — if credits are "platform utility", not "investment"
- **Token sale for fiat:** ⚠️ Could trigger if positioned as fundraising
- **Mitigation:** Always frame as "purchasing platform access credits", never "investing in tokens"

### 10.8 "Never Hold Funds" — Core Architectural Principle

This is the single most important technical decision for ENK viability:

| Principle | Implementation |
|-----------|---------------|
| **Fiat payments** | All fiat processed by Vipps (licensed PSP) — platform never touches user money |
| **Crypto wallets** | Users connect their own wallets via wagmi (EVM) / Solana adapter — platform never custodies |
| **Credit balance** | Database entries only — not redeemable for fiat, not transferable between users |
| **Token distribution** | Direct to user's connected wallet — platform doesn't hold tokens for users |
| **P2P trades** | Wallet-to-wallet transfers — platform is a classifieds/matching service, not an exchange |
| **Revenue collection** | Platform earns from Vipps fees, sponsor contracts, premium features — all fiat via Vipps |

**Why this matters:** If we hold funds, we trigger Betalingstjenesteloven (payment services regulation), e-money licensing, and potentially CASP authorization. All of these require legal entity (AS minimum), Finanstilsynet approval, and significant capital reserves. The "never hold funds" principle keeps us in the safe zone.

### 10.9 Privacy Policy: GDPR Blocker

The current `/privacy` page is **non-compliant** even for gated beta. It must include (GDPR Art. 13/14):

1. Data controller identity & contact (THORSEN SOFTWARE, org.nr 937 051 107, email, address)
2. Categories of personal data processed
3. Legal basis for each processing activity
4. Retention periods per data type
5. Third-party recipients (Vercel, Pusher, EdgeStore, OAuth providers)
6. International transfers + safeguards (Standard Contractual Clauses)
7. Data subject rights (access, rectification, erasure, portability, restriction, objection)
8. Right to complain to Datatilsynet
9. Automated decision-making disclosure (REACH scoring, verification tiers)
10. Children's data policy

**This is Phase 0 work — must be done before any other feature development.**

Cross-reference: [NORWAY_LEGAL_COMPLIANCE.md §3](NORWAY_LEGAL_COMPLIANCE.md)

---

## 11. Payment Flows

### 11.1 Accepted Payment Methods

| Method | Phase | Flow | Settlement |
|--------|-------|------|------------|
| **Vipps (NOK)** | Phase 3+ | Vipps checkout → credits added to DB | Instant |
| **VEGGA token** | Phase 3+ | Transfer to VeggaSystem wallet → credits | On-chain confirmation |
| **ETH** | Phase 4+ | Swap to VEGGA via PulseX/Uniswap V3 | ~15s on-chain |
| **USDC/USDT** | Phase 4+ | Swap to VEGGA via DEX router | ~15s on-chain |
| **Free tier** | Phase 0+ | No payment needed — 5 actions/day included | Instant |

### 11.2 On-Chain Payment Flow (Phase 3+)

```
User → connects wallet (MetaMask/WalletConnect via wagmi)
     → selects "Buy Credits" amount
     → chooses payment token (VEGGA, ETH, USDC)
     → if not VEGGA: frontend calls DEX quoter for best price
     → user approves token spend (EIP-2612 permit for gasless)
     → user confirms swap/transfer tx
     → backend monitors tx receipt (viem watchContractEvent)
     → credits balance in DB (off-chain ledger + on-chain truth)
```

### 11.3 VeggaSystem Wallet Role

`0x018F6bF56814Dfa2543f98041e44A202b3632636`

| Function | Description |
|----------|-------------|
| **Treasury** | Holds undistributed VEGGA supply (25% allocation) |
| **Liquidity provider** | Owns PulseX + Uniswap LP positions |
| **Revenue receiver** | Collects platform fees (action costs paid in VEGGA) |
| **Reward distributor** | Sends earned VEGGA to users (from Community Rewards allocation) |
| **Burn initiator** | Executes quarterly buy-and-burn transactions |

All treasury operations require admin approval via the admin panel (multi-step: initiate → confirm → broadcast). Emergency actions have a 24-hour timelock.

---

## 12. Technical Architecture

### 12.1 Smart Contracts

```
contracts/
├── VeggaToken.sol          # ERC-20 + ERC20Permit + Ownable + Pausable
├── VeggaVesting.sol        # Linear vesting for founder/advisors/community
├── VeggaLiquidityLock.sol  # Timelock for LP tokens (12-month minimum)
└── test/
    └── VeggaToken.test.ts  # Hardhat tests (100% coverage target)
```

**Toolchain:** Hardhat + OpenZeppelin Contracts v5. Token is NOT upgradeable. Vesting contracts use OpenZeppelin VestingWallet.

### 12.2 Credit Service (Phase 0-1, Off-Chain)

```
Prisma models:
  model CreditBalance {
    id          String   @id @default(cuid())
    userId      String   @unique
    balance     Decimal  @default(0)
    lifetime    Decimal  @default(0)     // Total ever earned
    spent       Decimal  @default(0)     // Total ever spent
    burned      Decimal  @default(0)     // Total permanently removed
    updatedAt   DateTime @updatedAt
    user        User     @relation(...)
  }

  model CreditTransaction {
    id          String           @id @default(cuid())
    userId      String
    type        CreditTxType     // EARN, SPEND, BURN, CONVERT
    amount      Decimal
    action      String?          // "create_quiz", "streak_bonus", etc.
    metadata    Json?            // Quest ID, referral info, etc.
    createdAt   DateTime         @default(now())
    user        User             @relation(...)
  }

  enum CreditTxType {
    EARN      // Rewards, streaks, referrals
    SPEND     // Action costs
    BURN      // Permanent removal (premium features)
    CONVERT   // Credit → Token (Phase 3+ only)
  }
```

### 12.3 Token Integration (Phase 3+)

```
Additional Prisma models:
  model TokenTransaction {
    id          String         @id @default(cuid())
    userId      String
    type        TokenTxType    // DEPOSIT, WITHDRAW, CONVERT
    amount      Decimal
    txHash      String?        // On-chain tx hash
    chain       String?        // "pulsechain" | "ethereum"
    createdAt   DateTime       @default(now())
    user        User           @relation(...)
  }

  enum TokenTxType {
    DEPOSIT    // On-chain → off-chain (buy credits with VEGGA)
    WITHDRAW   // Off-chain → on-chain (convert credits to VEGGA)
    CONVERT    // Credit→token conversion record
  }
```

### 12.4 PulseChain Configuration

```typescript
// Already supported in wagmiConfig — chainId 369
// RPC: https://rpc.pulsechain.com (or Infura/Alchemy when available)
// Explorer: https://scan.pulsechain.com
// DEX: PulseX (https://pulsex.com)

// Deployment config (Hardhat):
networks: {
  pulsechain: {
    url: "https://rpc.pulsechain.com",
    chainId: 369,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY]
  },
  ethereum: {
    url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
    chainId: 1,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY]
  }
}
```

### 12.5 DPI Reporting Pipeline (Phase 3)

```
Marketplace sale → CreditTransaction logged
  → Aggregation service (weekly cron)
  → Seller threshold check (>30 transactions OR >€2,000)
  → If threshold hit: generate Skatteetaten XML report
  → Admin review in dashboard
  → Submit to Skatteetaten via their API/portal
```

### 12.6 Frontend Changes (Phased)

| Phase | New Files | Description |
|-------|-----------|-------------|
| 0-1 | `hooks/use-credit-balance.ts` | Fetch user credit balance |
| 0-1 | `components/credits/CreditBalance.tsx` | Display balance + earn/spend history |
| 0-1 | `app/api/credits/balance/route.ts` | Get credit balance API |
| 0-1 | `app/api/credits/spend/route.ts` | Deduct credits for action |
| 3+ | `components/crypto-related/VeggaSwapWidget.tsx` | DEX swap embed (PulseX/Uniswap) |
| 3+ | `components/crypto-related/TokenDashboard.tsx` | Admin token management |
| 3+ | `hooks/use-vegga-balance.ts` | On-chain VEGGA balance |
| 3+ | `lib/vegga-token.ts` | Contract address, ABI, chain config |

### 12.7 Existing Code Modifications (Phase 3+)

| File | Change |
|------|--------|
| `hooks/use-token-balances.ts` | Add VEGGA to `KNOWN_TOKENS` map |
| `components/crypto-related/CryptoInventory.tsx` | Show VEGGA balance in inventory |
| `lib/system-account.ts` | Add `tokenContractAddress` field |
| `PollBuilder.tsx` | Check credit balance before publish (if past free tier) |
| `components/crypto-related/PricingContext.tsx` | Add VEGGA price feed |

---

## 13. Rollout Phases

### Phase 0 — NOW (ENK, Gated Beta) ← WE ARE HERE

**Duration:** Ongoing until AS formation  
**Gate:** `GATE_STATUS=true`, password rotated regularly  
**Entity:** THORSEN SOFTWARE ENK

| Task | Priority | Status |
|------|----------|--------|
| Fix `/privacy` page (GDPR Art. 13/14) | 🔴 Blocker | ❌ Not done |
| Implement credit balance system (Prisma models) | 🟡 High | ❌ Not done |
| Integrate credit checks into poll creation | 🟡 High | ❌ Not done |
| Free tier: 5 actions/day for all users | 🟡 High | ❌ Not done |
| Credit earning for quiz completion/streaks | 🟡 High | ❌ Not done |
| Save 35,500 NOK for AS formation | 🟡 Important | ⏳ In progress |
| Separate business bank account | 🟢 Medium | ❌ Not done |
| Proper bookkeeping setup | 🟢 Medium | ❌ Not done |

### Phase 1 — Gamification (ENK, Gated Beta)

**Duration:** ~3-6 months  
**Gate:** Still closed, testers via password  
**Entity:** Still ENK

| Task | Priority |
|------|----------|
| Badge system (per-pillar, 4 tiers) | High |
| Streak tracking + multipliers | High |
| Leaderboard (Squad → City → National → Global) | High |
| Squad system (formation, challenges, treasury) | Medium |
| Impact Quest framework | Medium |
| Referral code generation (not yet rewardable) | Medium |
| OG Share Cards (watermarked "Beta") | Low |

### Phase 2 — AS Formation & Token Prep

**Duration:** When 35,500 NOK is saved  
**Gate:** Still closed  
**Entity:** Transition ENK → AS

| Task | Priority |
|------|----------|
| Register AS via Altinn | 🔴 Blocker |
| Transfer assets from ENK to AS | 🔴 Blocker |
| Update all legal pages with AS entity info | 🔴 Blocker |
| Deploy VeggaToken to PulseChain testnet (v369t) | High |
| Draft MiCA white paper (Annex I format) | High |
| Informal Finanstilsynet pre-consultation | High |
| Complete all compliance checklist items from §10.2 | High |
| Set up DPI reporting pipeline | High |
| WCAG accessibility audit | Medium |
| Community guidelines page | Medium |
| Content reporting system (DSA) | Medium |

### Phase 3 — Public Launch + Credits Live

**Duration:** After all Phase 2 blockers completed  
**Gate:** `GATE_STATUS=false` → **OPEN TO PUBLIC** 🚀  
**Entity:** AS (Aksjeselskap)

| Task | Priority |
|------|----------|
| Open access gate — public launch | 🔴 Milestone |
| Vipps payment integration live | High |
| Credit economy fully active | High |
| Referral rewards activated | High |
| Full consumer protection compliance (withdrawal forms, complaint handling) | High |
| DPI reporting active | High |
| Monitor MVA threshold (50,000 NOK) | Ongoing |
| Deploy VeggaToken to PulseChain mainnet | Medium |
| Credit→token conversion (if legal review approves) | Medium |

### Phase 4 — Token Economy (AS, Growth)

**Duration:** 6-12 months post-launch  
**Entity:** AS

| Task | Priority |
|------|----------|
| PulseX liquidity pool (VEGGA/PLS + VEGGA/USDC) | High |
| Uniswap V3 pool (VEGGA/WETH + VEGGA/USDC) | High |
| Quarterly burn mechanics live | High |
| Cross-chain bridge (LayerZero OFT evaluation) | Medium |
| Ethereum mainnet deployment | Medium |
| CASP evaluation (does volume warrant Finanstilsynet registration?) | Medium |
| Sponsor program for Impact Quests (B2B) | Medium |
| Staking for LP providers (if legally cleared) | Low |

### Phase 5 — Ecosystem (AS, Scale)

**Duration:** 12+ months post-launch  
**Entity:** AS

| Task | Priority |
|------|----------|
| API for third-party quiz platforms | Medium |
| White-label quiz builder with VEGGA integration | Medium |
| DAO governance (token holder feature proposals — NOT financial) | Low |
| Mobile app (React Native) | Low |
| International expansion (EN, SV, DA, DE) | Low |

---

## 14. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Smart contract vulnerability | 🔴 Critical | OpenZeppelin base, professional audit before mainnet, bug bounty from Emergency Reserve |
| Personal liability (ENK phase) | 🔴 Critical | Gate stays closed → no public users → minimal liability. Form AS before opening. |
| Gate password leak | 🟡 High | Rotate password regularly, use strong passwords, monitor for unauthorized access |
| Regulatory action (NOR/EU) | 🟡 High | Credits-first (no MiCA trigger), utility-only positioning, legal review before token launch |
| 30k AS funding delay | 🟡 High | Save consistently, explore Innovasjon Norge grants, delay launch if needed — never rush |
| Low liquidity / price manipulation | 🟡 High | Lock LP 12+ months, sufficient initial depth, PulseChain low-fee environment |
| Gas costs for small actions | 🟡 Medium | Credits are off-chain (zero gas). Only token conversion/withdrawal costs gas. PulseChain ~$0.001 per tx. |
| User confusion (credits vs tokens) | 🟡 Medium | Clear UI: "Credits" (off-chain, free) vs "VEGGA" (on-chain, token). Never mix terminology. |
| VeggaSystem wallet compromise | 🔴 Critical | Hardware wallet (Ledger), consider Gnosis Safe multisig for treasury |
| Solo dev bus factor | 🟡 High | Good documentation (this doc, MasterContext.md, agent.md), clean codebase, automated tests |
| MiCA exemption threshold exceeded | 🟡 Medium | Monitor user count per Member State and total consideration. Prepare white paper in advance. |
| folkefinansieringsloven trigger | 🟡 Medium | Frame all sales as "platform access credits", never "token investment" or "fundraising" |
| MVA registration missed | 🟢 Low | Monitor turnover monthly, register at Skatteetaten when approaching 50k NOK |

---

## 15. Open Questions

### Pre-AS (Answer Now)

- [ ] Should we set up Fiken or Tripletex for bookkeeping now?
- [ ] Is the current ENK bank account sufficient, or should we open a separate one immediately?
- [ ] Which Innovasjon Norge programs accept SaaS/tech applications from ENK?

### Pre-Token Launch (Answer Before Phase 3)

- [ ] Can an AS issue a utility token under MiCA Art. 4(3)(c) without CASP authorization, if "never hold funds" is maintained?
- [ ] Does Finanstilsynet accept pre-consultation requests from small entities?
- [ ] What's the Skatteetaten XML schema for DPI reporting?
- [ ] Does credit→token conversion trigger VASP registration?
- [ ] Should we use Gnosis Safe (multisig) for the VeggaSystem treasury?

### Long-Term (Answer When Relevant)

- [ ] What should the initial VEGGA launch price be? ($0.01 vs market-set via initial LP ratio?)
- [ ] Should we deploy on Base L2 as well for US/international users?
- [ ] Is there appetite for DAO governance (feature voting, not financial)?
- [ ] Revenue model: Does VEGGA earned from actions go back to treasury or get burned?
- [ ] Solana SPL token mirror — worth the complexity?
- [ ] Is Innovasjon Norge etablerertilskudd available for SaaS/Web3 projects?

---

## Reference: Current Infrastructure (Already Built)

| Component | Status | Files |
|-----------|--------|-------|
| **EVM wallets** | ✅ Live | `wagmiConfig/`, `crypto-related/evmConfig.ts`, `EvmWalletList.tsx` |
| **Solana wallets** | ✅ Live | `SolanaProviders.tsx`, `solanaEndpoints.ts` |
| **ERC-20 balance fetching** | ✅ Live | `hooks/use-token-balances.ts` — multicall for USDC/USDT/DAI/HEX/WBTC/LINK/UNI |
| **P2P trading** | ✅ Live | `TradeModal.tsx`, `TradeWindow.tsx`, ZKP verification |
| **Crypto payments model** | ✅ Live | Prisma `Payment` model with `tokenSymbol`, `senderAddress`, chain tracking |
| **Product accepted tokens** | ✅ Live | Prisma `ProductAcceptedToken` — per-product EVM/Solana token config |
| **Wallet linking + verify** | ✅ Live | `EvmWalletVerify.tsx` — EIP-712 signature verification |
| **Chain support** | ✅ Live | Mainnet, Base, Arbitrum, PulseChain (369), Sepolia |
| **VeggaSystem wallet** | ✅ Live | `0x018F6bF56814Dfa2543f98041e44A202b3632636` |
| **REACH scoring engine** | ✅ Live | 7 Pillars scoring — XP foundation for gamification |
| **Social graph** | ✅ Live | Follow, Friendship, Pulse feed, notifications |
| **Access gate** | ✅ Live | `GATE_STATUS=true`, `GATE_PASSWORD` via env var, cookie-based |

---

## Reference: GitHub Repository

The owner's previous EVM contract work:  
**https://github.com/veggaen/EVM-Contract-frontend**

Reusable patterns: Hardhat deployment scripts, contract ABI management, frontend wallet connection (already migrated to wagmiConfig).

---

*This document is for planning purposes only. No smart contract deployment, token minting, or financial operations shall proceed without explicit founder approval. All legal analysis is preliminary and not legal advice — consult a qualified Norwegian lawyer (advokat, MNA member) before executing any token-related activity.*
