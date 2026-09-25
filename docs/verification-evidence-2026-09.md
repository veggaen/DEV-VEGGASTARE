# Verification evidence — 25 September 2026

## Scope

Settings and the Reach breakdown now use the same current evidence snapshot,
not the saved score/tier. Real Chrome reproduced the old Live contradiction:
Web3 Verified / 45 points, but the wallet checklist was incomplete.

- OAuth requires an existing provider Account plus its confirmation flag.
- Wallet ownership requires a currently verified personal EVM/Solana wallet.
  Company wallets and unsigned wallets do not count.
- Payment trust requires an owned, positive, completed Live CheckoutAttempt
  with a capture ID, completion timestamp, completed Order and no refund.
  Sandbox, demo, pending, refunded/reversed and legacy client-reported payments
  do not count. No money, credits or download rights are changed by this reader.
- Cached donation totals and wallet brands do not prove payment, history or KYC.
  Crypto checkout proof remains unfinished; its old boolean cannot award trust.
- GET and UI Refresh are read-only and no-store. A read failure reports retry,
  never a fallback to stale trust. Cache maintenance has no email side effects.
- Legacy manual cache refresh checks origin, authentication, demo policy and
  the durable auth throttle. Serializable recalculation retries PostgreSQL
  `40001`, including Prisma's raw-query driver-adapter wrapper.
- Pending donation claims no longer increment verified wallet totals or award
  trust. Concurrent duplicate hashes return 409. The wallet list totals only
  explicitly confirmed records; existing submission copy says verification is
  pending. New donation-reward transfers are visibly unavailable until a real
  server verifier can deliver the promised reward. Web3 mode alone earns no trust.

This is experimental engagement scoring, not identity assurance. Server-side
crypto reconciliation and its end-to-end acceptance remain incomplete. Older
engagement consumers still use persisted caches; a full historical cache audit
is not claimed here. Auth/wallet changes refresh caches, while settings/Reach
always read current evidence without requiring a write or sending email.

## Verification

- 55 unit cases pass: canonical evidence, guarded refresh, donation claims and
  the existing OAuth state/action boundaries.
- 13 isolated PostgreSQL cases pass, including ten excluded payment states,
  a valid Live-shaped test capture, parallel cache refreshes and immediate
  refund/unlink visibility. This uses minimal disposable `qa_evidence_*` tables,
  not production records, actual PayPal money or a complete migrations fixture.
  Missing fixture columns/enums were corrected. The race exposed the real
  Prisma raw-query serialization wrapper; both implementation and tests fixed.
- No real email, OAuth confirmation/removal, payment, refund, signature,
  AI provider request or credit grant was performed in this slice.
- Final webpack/TypeScript build passes (188 static pages). Focused server,
  settings, auth and hook lint passes. Full wallet-component/E2E lint remains
  running; no success is claimed for that process yet.
- Final local browser checks: **2/2 pass**, 16.2s, no retries/skips. The new
  unmocked test checks demo exclusion, calculated score, agreement with the
  Reach API, four widths (360/390/1280/2560), footer scrolling and Refresh
  without POST. Existing OAuth feedback/review test covers five widths and
  both themes with controlled API/email-failure fixtures. Screenshots at 390
  and 1280 were visually inspected.
- Real Chrome local account: Email Verified / 10 points, Google and GitHub
  confirmation still pending. Crypto payment verification clearly unavailable;
  no new consent or mail requested. Live deployment/acceptance pending.

## Reproduce

From `frontend/`, run `node node_modules/vitest/vitest.mjs run
lib/verification-evidence.test.ts lib/donation-claims.test.ts
lib/oauth-links.test.ts lib/oauth-link-state.test.ts`.

The opt-in database file `lib/verification-evidence.database.test.ts` requires
`TEST_VERIFICATION_DATABASE=1` and an isolated Preview database accepted by
`previewDatabaseUrl`. It removes only its own validated disposable schema.

The focused browser test in `e2e/suite.spec.ts` uses
`E2E_VERIFICATION_EVIDENCE=1` and `E2E_DEMO_STORAGE_STATE` from an app-issued
demo session. No verification API response is mocked in that test.
