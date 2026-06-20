# Veggat 2036 Engineering System

This is the working standard for moving Veggat from feature-rich to trust-grade.

## Product Thesis

Veggat should become a trust-first commerce operating system: sellers can create,
verify, sell, deliver, and support digital or physical products through a guided
cockpit, with voice and AI as first-class input methods.

## Operating Loop

Every meaningful change should pass this loop:

1. Architecture: identify data ownership, trust boundaries, auth, persistence, and rollback path.
2. UX: map the user intent, the failure states, and the minimum path to confidence.
3. Implementation: keep changes scoped and align with existing Next.js, Prisma, server action, and component patterns.
4. Verification: run type checks, Prisma validation, build when relevant, and the experience audit.
5. Visual review: screenshot the route at desktop and mobile sizes, inspect text fit, spacing, hover/transition states, and loading/empty/error states.
6. Production readiness: list migrations, env requirements, payment/provider approvals, and manual verification steps.

## Tooling

Run the quick audit:

```powershell
npm run audit:experience
```

Run the production-facing audit:

```powershell
npm run audit:experience:build
```

The report is written to:

```text
scripts/_probe/experience-audit/last-report.md
```

## Current Core Tracks

### Seller Creation

Goal: creating a listing should feel like guided publishing, not form survival.

Required qualities:
- top-down flow with obvious progress
- exact publish blockers
- image/file upload confidence
- payment readiness that explains PayPal, wallet, fiat, and crypto separately
- per-chain receiving destinations
- checkout simulation before publishing

### Digital Delivery

Goal: digital products should be safe to upload and safe to receive.

Required qualities:
- explicit MIME and extension allowlist
- private storage by default
- checksum and immutable asset record
- signed buyer download tokens
- post-purchase delivery view
- future: malware scanning, file quarantine, abuse reports, seller file reputation

### Wallets

Goal: users understand the difference between active wallet sessions and verified payout identities.

Required concepts:
- connect session
- disconnect session
- verify/link wallet
- remove saved link
- set default payout wallet
- choose per-product payout destination
- choose per-token/per-chain payout destination

### PayPal

Goal: no ambiguous "pending verification" state.

Required concepts:
- seller receiving email verification
- marketplace/platform approval status
- buyer checkout availability
- payout routing capability
- sandbox/live mode separation

### Voice

Goal: voice feels like a native room layer, not a fragile sidebar experiment.

Required qualities:
- screen-level settings modal
- explicit microphone permission request
- device enumeration after permission
- live input meter
- input/output selectors
- test recording or loopback confidence
- push-to-talk and voice activity modes
- graceful fallback when browser permissions are blocked

## UI Standard

Avoid:
- generic cards inside cards
- unearned hero sections on utility tools
- overuse of pills and tags
- negative-margin layout patches
- generic failure messages
- animation that blurs content or creates gaps

Prefer:
- quiet, structured work surfaces
- one clear primary action per stage
- progressive disclosure for advanced controls
- precise recovery copy
- motion on transform/opacity only
- stable dimensions for cards, media, and controls

## Interaction Pattern

Veggat interfaces should feel simple at rest and capable in motion.

Default state:
- show the minimum fields needed to understand the task
- keep labels short and direct
- avoid dense helper paragraphs and stacked warning blocks
- keep controls aligned and stable

Active state:
- reveal guidance when a field is focused
- show inline examples only when they help the current input
- expose advanced options through disclosure rows, tabs, popovers, or info icons
- keep error recovery next to the broken field

Hover/open state:
- use info icons for deeper explanations
- reveal secondary controls only when the user approaches the relevant surface
- animate with opacity, translate, and scale; avoid layout jumps
- keep text wrapping inside its container, especially hashes, addresses, and ids

The rule: never remove important capability to make a page look cleaner. Hide
complexity until the user needs it, then reveal it smoothly and locally.

## 2036 Outcome

The app should move from "user fills fields" to "user declares intent and verifies the result."

Example:

> List this signed image for 50 NOK, accept PayPal and ETH, deliver after payment,
> use my main EVM wallet, add a limited personal-use license, and simulate checkout.

Veggat should draft the listing, validate payments, scan the file, route payouts,
preview buyer delivery, and explain what remains before publish.
