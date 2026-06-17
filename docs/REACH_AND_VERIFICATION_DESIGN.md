# Reach & Verification — Design Doc (v1, for review)

Status: **DRAFT — awaiting your approval before implementation.**
Author: engineering pass for VeggaStare. Extends the EXISTING system; does not replace it.

---

## 0. What already exists (we build on this, not over it)

The codebase already has a strong foundation — this doc extends it:

- `UserVerificationTier` enum (13 tiers): `ANONYMOUS → WALLET_ONLY → WEB2_BASIC → WEB3_BASIC → SOCIAL_BASIC → SOCIAL_VERIFIED → MULTI_SOCIAL → WEB2_PAYMENT → WEB3_VERIFIED → WEB3_PAYMENT → PAYMENT_VERIFIED → PHONE_VERIFIED → FULLY_VERIFIED`.
- `lib/view-strength.ts` — `VERIFICATION_TIER_MULTIPLIERS` (0.1–1.0): the "honest reach" weight already applied to how much a user's views/votes count.
- `lib/verification-recalc.ts` — `recalculateVerificationTier()` recomputes tier on auth/payment/phone events.
- Per-signal flags on `User`: `hasGoogleAuth`, `hasGithubAuth`, `hasDiscordAuth`, `hasWeb2Payment`, `phoneVerified`, `emailVerified`, donation totals, materialized `reachLifetime` / `reachMomentum`.

**Conclusion:** the trust→reach link is real and live. This doc adds: (1) two high-trust providers, (2) a *risk/penalty* axis (disposable email, anon wallets), (3) a single transparent **True Reach** formula, and (4) honest display.

---

## 1. Goals

1. Let users sign up/in via more identity layers, each weighted by how strongly it proves a real, unique human.
2. Add a **risk** axis so weak/abusable signals (disposable email, unverified, fresh anon wallet) *lower* trust honestly.
3. Compute one transparent **True Reach** number per user, explainable on hover ("why is my reach this?").
4. Keep everything **server-authoritative** and tamper-resistant.

## 2. Identity trust — independent classes, each capped, then SUMMED

**Core principle (anti-exploit AND completeness-rewarding):** trust is grouped
into *independent evidence classes*. Diminishing returns applies **only within a
class** (so you can't farm 5 cheap correlated socials into high trust — Sybil
defense). Across classes, every additional class **always adds** — because a
government ID *and* a bank phone *and* a real payment is genuinely more proof of
a unique human through independent channels.

> Therefore: **verifying ALL methods = the maximum trust score, by
> construction.** Completeness is never penalized; only *redundant stacking
> inside one class* is.

```
trust = Σ over classes of  min(classCap, Σ methods in that class)
```

| Class | Cap | Methods (intra-class) | Why independent |
|---|---|---|---|
| Government eID | 100 | BankID (Criipto). `:substantial`/biometric slightly higher | Strongest single proof; hard to fake/duplicate |
| Bank / phone | 70 | Vipps 70 · SMS phone 35 (take max within class, small bonus if both) | Bank-linked / carrier-linked identity |
| Payment | 40 | Card (web2) 30 · Web3 spend 25 (diminishing if both) | Real money + friction |
| Social / email | 35 | Google 20 · GitHub 20 · Discord 12 · verified email 8 — **diminishing returns inside** (1st full, 2nd 60%, 3rd 30%) | All "low-friction email" — correlated, so capped |
| Wallet provenance | 25 | signed wallet 10 + source/KYC bonus (§4) | On-chain identity, weighted by provenance |

Worked examples (illustrative, numbers tunable in config):
- **Only 5 socials** → Social class caps at 35. Total ≈ 35. (Sybil farmer gets little.)
- **BankID only** → 100. (One strong proof already beats 5 socials.)
- **Everything** (BankID + Vipps + phone + card + Google + GitHub + wallet) →
  100 + 70 + 40 + 35 + 25 = **270 = the ceiling** → maps to `FULLY_VERIFIED`. ✅

Email present but **unverified** contributes ~0 to its class until verified
(and is risk-flagged, §5) — it's an entry ticket, not trust.

**Multi-provider cap:** social providers contribute with diminishing returns (e.g. 1st=full, 2nd=60%, 3rd=30%) so "link 5 socials" can't rival one BankID. Cross-provider *same-email* still grants a `MULTI_SOCIAL` cross-verification bonus (already modeled).

## 3. Email verification tiers (your "let them in, but flagged" idea)

- **Allow account creation with a valid-format, MX-resolvable email WITHOUT clicking the link** — but at a capped low tier (`WEB2_BASIC`, reach multiplier ≤ 0.4) and a visible **"Unverified"** badge.
- Pre-checks at signup (no extra service needed): RFC format + **DNS MX lookup** (reject domains with no mail server). Cheap, server-side.
- Verifying the email later lifts the cap and removes the badge.
- **Disposable-email risk** (§5) applies on top regardless of verification.

## 4. Web3 wallet source risk (your Coinbase/KYC insight)

A wallet alone is weak; *provenance* matters. Risk score per wallet:
- **Lower risk:** wallet connected via a custodial/KYC source (Coinbase Wallet/Smart Wallet, known exchange-linked) — treat closer to an OAuth-grade signal.
- **Neutral:** self-custody (MetaMask) with a signed message + non-trivial on-chain history/age.
- **Higher risk:** brand-new wallet, zero history, no signed message.
- Signals we can read on-chain/cheaply: account age (first tx), tx count, balance, connector type (we already store `authProvider`/`connectorType` on `Wallet`). Donation totals already feed trust.

## 5. Risk / penalty axis (NEW)

A `riskScore` (0–100, higher = riskier) computed from negative signals:
- Disposable/temporary email domain (maintained blocklist + heuristics: known throwaway TLDs, MX patterns). 10minutemail etc. → high.
- Unverified email + no other strong signal.
- Brand-new anon wallet as sole identity.
- Velocity flags (many accounts/IP, rapid actions) — hook into existing rate-limit data.

**True Reach** = `f(trustPoints, behavioralReach) × (1 − riskPenalty)`, where `riskPenalty` scales with `riskScore`. So a verified-but-disposable-email user ranks above an unverified one, but both below a phone/BankID user — exactly your stated intent.

## 6. The True Reach formula (transparent)

```
trust      = Σ class_score  (each class capped; diminishing returns ONLY inside a class — §2)
             → maxed when ALL classes are satisfied (verifying everything = highest trust)
behavior   = existing reachLifetime/momentum + pillar signals (already built)
risk       = riskScore/100 (§5)
TrueReach  = round( (W_trust·normalize(trust) + W_behavior·normalize(behavior)) × (1 − k·risk) )
```
- `W_trust`, `W_behavior`, `k` live in one config file — tunable, documented.
- Stored materialized on `User` (like `reachLifetime`), recomputed on the same events as `recalculateVerificationTier`.
- **Every component is explainable** → drives the hover card (§7).

## 6b. Economic reach (individual) — accountable commerce

True Reach also rewards real, *arms-length, fulfilled* commerce — not raw volume
(which is wash-tradeable). Each economic signal is its own capped segment:

| Signal | Source (exists) | Anti-game rule |
|---|---|---|
| Sales completed (earned) | `Sale`, `Order.status=COMPLETED`, `totalAmount` | buyer ≠ seller & buyer not a known alt; refunded orders excluded |
| Purchases (spent) | `Order` (paid) | smaller weight than sales; same arms-length rule |
| Packages shipped / fulfilled | `Order.fulfilmentStatus=FULFILLED`, `shippedAt`, `fulfilledById` | only counts *delivered* fulfillment, not self-marked |
| Buyer/seller ratings | (future `Review`/rating) | weighted by rater's own trust |

- Each segment uses **log/diminishing scaling** (the 1000th sale adds less than
  the 10th) and a cap — so a whale and a fraudster-farmer don't dominate.
- Self-dealing (buyer==seller, alt rings detected via `riskScore`) is filtered
  AND penalized.

## 6c. Company Reach — aggregate WITHOUT pyramids (single layer)

**The rule that prevents MLM inflation: aggregation is exactly ONE hop deep.**
Company reach pulls its employees' *individual* reach, but never recurses into
employees' followers or sub-companies. Computed as labeled, separate segments:

```
CompanyReach = W1·companyOwnFollowers(deduped)
             + W2·companyCommerce(sales/fulfilment/ratings, §6b rules)
             + W3·teamContribution      ← 1 layer only, capped, diminishing
```

- **`companyOwnFollowers`** — humans who follow the company directly (needs a
  new `CompanyFollow` table, user→company). **Deduplicated**: a person who
  follows the company *and* 3 employees is counted **once** toward social reach.
- **`teamContribution`** — Σ over employees of `normalize(employee.trueReach)`,
  with **diminishing returns** (10th employee « 1st) and a **hard cap**, so you
  can't farm company reach by mass-hiring alt employees. An employee's reach
  feeds **one** company at full weight (split if genuinely multi-employed).
- **No cascading:** employees-of-employees, followers-of-followers, and
  company-as-employee-of-company are all **excluded by construction**. One hop.
- **De-dup across the whole company graph:** every distinct human contributes at
  most once to the social component (union of follower sets, not sum).

**Worked comparison (your example):**
- *Account A:* BankID + phone + Vipps + lots of paid/sold/shipped commerce →
  high **individual** TrueReach (identity ceiling + strong, fulfilled, arms-
  length §6b commerce).
- *Company B:* sums its own followers (deduped) + its own commerce + its team
  (1 layer, capped). A large honest team + real direct following + real
  fulfilled sales → high **company** reach — but a 50-alt-employee shell with no
  real followers/commerce hits the team cap and the §5 risk penalty, so it
  *cannot* out-rank a genuine operator.

Individual reach and company reach are **separate, separately displayed**
numbers (a person isn't "worth" their company's reach, and vice-versa).

## 6d. Web3 wallets, linking & Web3 mode (best-flow design)

Builds on what exists: `Wallet` (`family`/`chainId`/`solanaCluster`,
`ownerUserId`, `verifiedAt`, `connectorType`/`authProvider`, `donationTotalUsd`),
challenge→verify endpoints (SIWE-style signed message), and the `web3ModeEnabled`
toggle.

**Linking flow (one identity, many wallets):**
1. Connect wallet (wagmi/AppKit or Solana adapter) → request a one-time
   **challenge** (`/api/wallets/evm/challenge`).
2. User **signs** the challenge → `/verify` confirms ownership, sets
   `verifiedAt`, links `ownerUserId`. Only a *signed* wallet counts for trust.
3. A user may link **multiple** wallets (EVM + Solana); one is `isPrimary`
   (receiving/display). Unlinking requires re-auth.
4. **A wallet links to exactly one account** (`ownerUserId` unique per verified
   wallet) — prevents one wallet inflating many accounts. Attempting to link an
   already-linked wallet → offer "this wallet belongs to another account"
   (supports the account-recovery/merge flow, gated by re-verification).

**Web3 ↔ Web2 unification (seamless, your goal):**
- A wallet-first visitor can browse; to gain trust/reach they link a Web2
  identity (or vice-versa). Either order works; both populate the same `User`.
- The **AppKit social/email bridge** (already in repo) can mint a Web2 identity
  from a wallet sign-in; we attach it to the same account by email match
  (with `allowDangerousEmailAccountLinking` already set) or explicit linking.

**Wallet trust = provenance, not mere presence (§4 risk):**
- `connectorType`/`authProvider` → KYC/custodial sources (Coinbase Smart Wallet,
  exchange-linked) score higher; fresh anon self-custody scores lower.
- On-chain age + tx count + balance + `donationTotalUsd` raise the wallet's
  contribution within the Wallet-provenance class (cap 25, §2).

**Web3 mode:** a per-user toggle that surfaces crypto features (pay/receive in
crypto, wallet panel, donations). Off by default for non-crypto users so the
app stays clean; on → reveals the wallet UI. Reach treats web3 signals
identically whether mode is on/off (mode is presentation, not trust).

## 7. Honest display (profile + hover card)

- **Profile (user):** True Reach + tier badge + stacked breakdown
  (`Identity 100 · Activity 240 · Commerce 60 · Risk −5%`) + verified methods
  (BankID ✓, Phone ✓, Email unverified ⚠).
- **Company page:** Company Reach as a **labeled stack** —
  `Followers (deduped) · Commerce · Team (1 layer, capped)` — each segment
  expandable to show "why." Individual vs company reach shown as **separate**
  numbers.
- **Hover card** (UserHoverCard, exists): compact reach + top 2 trust signals +
  verified checkmarks. Public signals only — never private data.
- **Honesty rule:** display = the real stored computation. No vanity inflation;
  unverified/risky/capped states are shown, not hidden.

## 8. Motion / UX principles (applied to all reach + auth surfaces)

- **Transform-only animation** (translate/scale/opacity) on the GPU — never animate layout properties. Combine `transition` + `transform` so state changes read as one fluid morph, not a "transition."
- **Shared-layout** for tier badge → expanded breakdown (framer-motion `layoutId`), spring physics (stiffness ~400, damping ~32), reduced-motion respected.
- **Intentional z-layering:** hover card above content, below modals/nav; reach breakdown expands in place without reflowing siblings.
- **Orchestrated stagger** on lists (already used). 60fps budget; pause offscreen.

## 9. Provider integration specifics (review-ready)

### Vipps Login (you submit for approval)
- Standard OIDC `code` flow. Scopes: `openid name phoneNumber email address birthDate` (request only what we use).
- **Exact** redirect_uri on portal.vipps.no: `https://www.veggat.com/api/auth/callback/vipps` (capitalization + no trailing slash must match).
- Onboarding: whitelist redirect URI, use only required scopes, follow Vipps design guidelines, submit the **Login checklist to developer@vippsmobilepay.com**.
- Code: custom Auth.js OIDC provider behind `AUTH_VIPPS_ID`/`AUTH_VIPPS_SECRET` env flags — dark until keys exist. Maps to trust weight 70 + `phoneVerified`.

### Criipto BankID (you get broker account)
- OIDC `code` flow via Criipto Verify. Register app → `client_id`/`client_secret` + callback `https://www.veggat.com/api/auth/callback/criipto`.
- `acr_values=urn:grn:authn:no:bankid` (or `…:substantial` for biometrics).
- Behind `AUTH_CRIIPTO_*` env flags. Maps to trust weight 100, sets a `bankidVerified` flag → top tier eligibility.

## 10. Data model additions (Prisma)

```
User {
  trueReach        Float    @default(0)   // materialized (§6)
  riskScore        Int      @default(0)   // 0–100 (§5)
  bankidVerified   DateTime?
  vippsVerified    DateTime?
  emailRisk        String?  // 'disposable' | 'unverified' | 'ok'
}
Wallet { riskTier  String?  } // 'kyc' | 'neutral' | 'fresh' (§4)
```
All additive, defaulted → safe migration (same pattern as the recent drift fix).

## 11. Staged build plan

1. **S1 — Core algorithm + config** (no keys): class-based trust (§2) + riskScore
   (§5) + TrueReach (§6) in one well-tested module; materialize on User; unit
   tests incl. the "verify-all = ceiling" and "5-socials = capped" cases.
   *Highest value, ships first.*
2. **S2 — Honest display:** user profile breakdown + hover card, with motion (§8).
3. **S3 — Email risk:** MX check + disposable-domain list at registration;
   "Unverified" badge + capped tier (§3).
4. **S4 — Economic reach (individual):** accountable, arms-length commerce
   segment from `Sale`/`Order` (§6b).
5. **S5 — Company Reach:** `CompanyFollow` table + 1-layer, deduped, capped
   aggregation (§6c) + company-page display.
6. **S6 — Web3 source risk + linking polish:** wallet provenance scoring (§4)
   and the link/merge flow (§6d).
7. **S7 — Providers:** Vipps (review-ready, dark) + Criipto BankID (activate on
   your broker keys) (§9).

## 12. What requires YOU (cannot be done from code)
- Vipps merchant/portal account + submit Login checklist.
- Criipto (or Signicat) broker account + contract for BankID.
- Paste the resulting keys into Vercel env. I wire everything else.

---
*Sources for provider requirements: Vipps Login API docs & checklist; Criipto Verify OIDC docs (acr_values for Norwegian BankID). Links provided in chat.*
