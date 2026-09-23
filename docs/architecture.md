# Veggat architecture

Veggat's flagship is the digital marketplace. AI credit accounting demonstrates
the same principle: access is granted by a trusted server event, not browser state.
The [scoreboard](production-scoreboard.md) separates implementation from verified
production behavior; the presence of an integration is not a readiness claim.

## Boundaries

- **Next.js reference client and application server (Vercel).** Auth.js sessions,
  catalogue/cart, checkout, AI generation and signed digital-delivery routes live
  in `frontend/`. The persistent shell keeps navigation mounted while main
  content changes. Browser code never receives platform provider secrets.
  Root rendering initializes that shell from the server-verified session so
  identity-dependent banners/composers do not arrive after a visitor scrolls.
  Personalized HTML is request-rendered and private/no-store, not CDN-shared;
  public assets/data can retain their separate caches. This trades a small
  server lookup for correct first-paint geometry and removes the initial
  browser session-fetch waterfall. APIs/actions still authorize independently.
- **PostgreSQL / Prisma.** Product, cart and order records; authenticated download
  entitlements; environment-separated credit accounts, ledger entries and request
  reservations. Database uniqueness and nonnegative-balance constraints complement
  application guards. Schema and migrations are in `frontend/prisma/`.
- **Hapi integration core (Railway).** Shipping and warehouse/realtime experiments
  live in `backend/`, independent of React. Its health endpoint is `/v1/health`.
  The unauthenticated legacy stock/Pusher endpoints now return 410 and the
  legacy socket refuses connections; current handlers open no database client.
  Backend deployment, shipping authorization and operational readiness remain separate
  audit items; they are not required for private digital sample delivery.
- **External systems.** PayPal for verified orders, private storage for digital
  bytes, AI providers for bounded generation, and Pusher for application events.

## Four deliberate tradeoffs

1. **Server-owned money.** Server SKU prices and verified capture bind amount,
   currency, merchant and internal order. A unique capture identity and a database
   transaction prevent replay grants. It costs more integration work than a
   redirect-based demo, but the return URL cannot authorize delivery.
2. **Atomic AI reservation plus a separate fuse.** Reserve credits before the
   provider call; settle success or refund failures once. Input/output/time/model
   bounds and a global conservative cost allowance protect platform funds even
   when an account has credits. Flat message prices are easier to explain than
   precise token invoices, but need periodic price review.
3. **Private delivery.** Public gallery previews are separate from purchased
   files. Authenticated, expiring entitlement checks precede byte delivery.
   This adds server traffic but avoids guessable public download URLs.
4. **A separate integration service.** Hapi can support future clients and
   logistics processes independently of Next. The tradeoff is another service,
   authentication boundary and deployment to maintain—not a reason to add more
   features before finishing the marketplace.

## Environment and verification

Local OAuth is `http://localhost:3000`. Local/preview payments use Sandbox;
Production uses Live. DEMO, SANDBOX and LIVE credit balances never substitute for
one another. Demo identities are temporary and isolated, cannot make real
purchases or change payout details, and receive a bounded one-time AI allowance.

Vitest covers business rules and provider failures. Opt-in PostgreSQL tests use a
disposable schema for credit concurrency. Playwright exercises real UI journeys
locally and after deployment; injected test wallets cannot sign or send funds.
Analytics and Speed Insights wait for visitor consent. Automated measurements
are not represented as real-visitor field data.

**Open release gates:** PayPal credentials and actual transactions; full OAuth
consent/callback coverage; owner-wallet/payout verification; remaining-route and
integration-service audit. See [credit safety](ai-credit-safety.md) and
[responsive QA evidence](responsive-audit.md) for exact limits and coverage.
