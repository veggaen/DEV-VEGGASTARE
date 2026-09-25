# Veggat

Veggat is a trust-first marketplace for digital products: discover a file, checkout, and receive an authenticated, time-limited download. Multi-provider AI adds a second example of server-authoritative access and billing.

[Live app](https://www.veggat.com) · [Architecture](docs/architecture.md) · [Verified feature scoreboard](docs/production-scoreboard.md) · [Frontend setup](frontend/README.md)

## Try it in 90 seconds

Open the public homepage and choose **Try the demo — no payment**. No password or card is needed: each visitor gets an isolated, temporary account, not shared credentials.

1. Open **Fjord Study — Digital Artwork**, inspect its gallery, and add it to the cart.
2. Complete the clearly labelled **free demo checkout** and download the real JPG and TXT.
3. Open **AI Chat**, select an available model, and review its credit cost.

The permanent products are **Fjord Study — Digital Artwork** (29 NOK) and **Veggat AI Credits** (39 NOK for 100 credits). Custom amounts and a **10-credit starter for 9 NOK** are available. Paying is optional: demo orders cost zero and never simulate a paid credit grant. One owner-approved 9 NOK Live purchase, its ten-credit grant, and subsequent OpenAI/Grok debits are verified. Live digital-file purchase/refund acceptance and provider-account spending caps remain open. See the [product and provider evidence](docs/permanent-products-2026-09.md).

The demo includes five one-time AI credits. Real OpenAI/Groq replies, saved conversations, credit debit and premium denial at zero have passed local and live browser tests. Sandbox credit-funded OpenAI and Grok messages have also been checked in real Chrome. Custom **100–10,000 credits**, linked spending-budget entry, progressive discounts and consistent fiat (crypto) display are deployed. The server prices the chosen credits; displayed conversion estimates cannot set the payment amount. See [credit-budget acceptance](docs/checkout-credit-budget-2026-09.md). A mixed Sandbox purchase of 122 credits and the digital pack passed capture, private delivery, full refund and replay checks in the [isolated Preview](https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app). This does not establish Live purchase or partial-refund acceptance. Read the scoreboard for model-specific evidence and release gates.

## Architecture

AI Studio adds private PNG images and four-second silent videos using the same
prepaid balance. Real OpenAI image and xAI video generation, downloads and credit
debits pass local and live browser tests. See [Studio evidence and limits](docs/ai-studio-2026-09.md).

```text
Browser → Next.js / Auth.js (Vercel) → PostgreSQL (Prisma)
                      ├→ Verified PayPal capture → entitlement / credit ledger
                      ├→ Bounded AI reservation → provider → settle / refund
                      ├→ Authenticated private digital delivery
                      ├→ Pusher realtime events
                      └→ Hapi integration core (Railway)
```

| Area | Technology |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS, Radix/shadcn, Framer Motion |
| Identity | Auth.js, OAuth, password authentication |
| Data/integrations | PostgreSQL, Prisma, Hapi |
| Tests | Vitest, Playwright, TypeScript |
| Operations | Vercel, Railway, consent-controlled Analytics / Speed Insights |

## Four decisions worth discussing

- **Verified money, not redirects.** The server owns NOK prices. Only a verified capture can fulfill an order; capture IDs are unique and grants are transactional. This adds integration work but prevents client-price tampering and duplicate fulfillment.
- **Reserve before AI spend.** Atomic balance updates, bounded model/input/output allowances, failure refunds and a separate platform fuse protect different failure cases. Conservative flat message prices trade precision for predictable costs.
- **Next as reference client; Hapi as integration core.** Shipping and warehouse integrations can evolve independently of the web UI, at the cost of another service to operate. These modules are experimental.
- **Stable layout and private telemetry.** Persistent shell navigation, constrained content widths, contained drawers and predictable loading states reduce visual jumps. Optional measurement waits for consent; automated lab tests are not claimed as field performance.

## Run locally

Use Node.js compatible with Next.js 16. Copy the frontend environment template to `frontend/.env.local`, then supply a **development database** and development provider credentials. Use PayPal Sandbox locally; never put Live PayPal credentials there.

```sh
npm install
npm install --prefix backend
```

In a frontend PowerShell terminal, load the local environment for Prisma's install hook:

```powershell
cd frontend
$env:DOTENV_CONFIG_PATH='.env.local'
npm install
npm run dev -- --webpack -p 3000
```

Start the integration service separately with `npm run dev --prefix backend`. Apply migrations only after checking the intended database target. Set `AUTH_URL=http://localhost:3000` and register the matching Google/GitHub/Discord callbacks; do not substitute another localhost port.

## Tests and release evidence

```sh
cd frontend
npm run test:unit
npx tsc --noEmit
npm run build -- --webpack
npm run test:e2e
```

App E2E tests live in `frontend/e2e/suite.spec.ts`. The focused interview workflow starts an empty PostgreSQL service and the production-style app on **:3000**, seeds synthetic products, then tests home → demo login → product → custom-credit cart → unpaid receipt. It checks a simulated checkout outage, stable retry identity and idempotent completion. Provider transport is mocked in payment unit tests; no PayPal/AI keys or production database secrets are available to this job. Its database is discarded with the runner.

The historical migration directory lacks an initial baseline, so this CI browser database uses `prisma db push` against an explicitly empty, loopback-only target. **That is not proof of a clean migration replay.** Applied upgrade migrations and real PostgreSQL constraints are verified separately on isolated Preview. See [CI acceptance](docs/ci-acceptance.md) for exact commands and current results.

Real-provider and recovery tests are opt-in; CI must not spend live money. AI ledger concurrency tests use a disposable PostgreSQL schema and require `TEST_AI_LEDGER_DATABASE=1`. They never alter real balances. [Credit safety notes](docs/ai-credit-safety.md) explain limits and failure tests; the [responsive audit](docs/responsive-audit.md) distinguishes real scrolling checks from untested interactions.

## Production versus experimental

The public catalogue, isolated demo, cart, free demo receipt and private sample delivery have local/live browser evidence. Sandbox capture, remote webhook/refund and replay reconciliation are verified. A 9 NOK Live credit purchase and paid AI usage are verified; Live digital-file purchase/refund acceptance remains open. Buyer notices retain downloadable originals, and guarded email copies distinguish provider acceptance from unverified human-inbox delivery. Full-agreement delivery and legal review remain open. Configured OAuth initiation has been checked, but every owner consent/callback is not yet verified.

Pulse, polls, Web3/wallets, trading, logistics and realtime voice are experimental modules, not the flagship product or a claim of production financial capability. AI audio transcription requires a personal OpenAI key until platform audio costs can be safely bounded.

No open-source licence has been selected; contact the owner before reuse.
