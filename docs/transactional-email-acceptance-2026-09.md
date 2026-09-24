# Transactional copies and scheduled-job protection — 24 September 2026

Status: implementation verified locally; Preview/production deployment acceptance
is recorded below as it completes. Actual email delivery remains **BLOCKED** on
the existing Resend credential returning HTTP 401. No customer email has been
sent as part of these tests. Seller review UI and full-agreement/legal review are
separate remaining work, not completed by this slice.

## What changed

- A new additive `TransactionalEmail` table stores an immutable recipient,
  payload and attachment with a unique source key. Migration does not enqueue
  historical orders. It belongs to the canonical frontend schema; the backend
  schema deliberately contains only the warehouse/inventory models it queries.
- Verified checkout fulfillment queues the original confirmation in the same
  database transaction. Buyer notices queue an acknowledgment in their creation
  transaction. Provider HTTP calls happen only after commit, outside those locks.
  A rollback creates no email. Existing historical acknowledgment bytes stay
  unchanged; new mailed copies use their retained attachment for downloads.
- Immediate post-response delivery and an hourly, bounded cron use the same
  database lease. At most three messages are processed per cron run, six send
  attempts per record and 100 first sends per UTC day across this queue.
  This cap is not a guarantee about all legacy auth email traffic/provider fees.
- Each retry uses the same Resend idempotency key and saved payload. Uncertain
  sends are held for manual review at 23 hours, before Resend's documented
  24-hour deduplication retention expires. There is no blind key rotation/resend.
- `ACCEPTED` means accepted by Resend, **not delivered**. Delivery requires an
  authenticated retrieval matching the provider ID and recipient. Delivery means
  delivered to the receiving mail server, not proof a person read the message.
  A sending-only key can send but cannot establish delivery via retrieval.
- Only the buyer's currently verified, unchanged account email is eligible.
  Demos send nothing. Local sending is disabled. Preview requires an explicit
  `TRANSACTIONAL_EMAIL_TEST_RECIPIENTS` allowlist, protecting cloned addresses.
- `TRANSACTIONAL_EMAIL_ENABLED` defaults off. New eligible records created while
  it is off go to `REVIEW`, not an automatically draining historical queue. Any
  later resend/requeue must be deliberate and check provider delivery first.
- Receipt UI distinguishes queued, accepted, delivered, skipped and needs-review
  states, keeps the download available, and never claims a request issued a refund.
- Reach-decay and daily-poll previously allowed access if `CRON_SECRET` was
  absent. Both now fail closed; the new email route uses the same timing-safe
  check. Separate 256-bit secrets were configured for Preview and Production.
  The existing daily-poll job still lacks a GET handler; its scheduler correctness
  is not claimed here. No authorized reach/poll job was manually run in production.

## Verification

- Touched ESLint and strict production-style local build/TypeScript pass.
- Payment/demo/cron units: **213 passed**, six opt-in DB cases skipped in that run.
- Isolated real Postgres outbox tests: **2 passed**. Eight concurrent enqueues
  produce one immutable record; rollback produces none. Eight competing workers
  send once and then use GET, not another send, to confirm a fixture delivery.
- The initial real concurrency test exposed Prisma's emulated empty-update
  upsert race. A per-source transaction advisory lock fixed it; the original
  concurrency assertion was retained and passes. Transport is a fixture, not a
  real Resend call; the disposable random QA schema was removed after the test.
- Local browser: **3/3 passed** (8.9s). Public/forged cron calls get 401; draft
  recovery, malformed-200 handling, real demo acknowledgment downloads and
  request replay remain correct. No paid order/credit status changed.
- Scroll/44px/no-horizontal-overflow checks cover 360, 390, 844 landscape, 768,
  1280 and 2560. 390/1280 screenshots reviewed. Real Chrome desktop verified the
  retained receipt and no-email demo wording. Its viewport override did not apply
  (actual width 2498); it was reset, not counted as mobile verification.

## Configuration and release boundaries

- `RESEND_API_KEY` exists in Vercel but an authenticated read-only Resend domain
  request returns 401. The old local key also returns 401. Resend sign-in is open
  in real Chrome for the owner; no new key has been created or exposed in chat.
- Keep sending disabled until the correct `veggat.com` sender/domain and a valid
  scoped key are verified. Verify a safe Preview recipient first, then production.
- Vercel UI reports Pro and an overdue-payment warning. Billing, payment methods,
  add-ons, budget limits and subscriptions were not changed.
- Full published sales terms/withdrawal disclosures still need versioned durable
  delivery and Norwegian legal review. This email purchase record is not a legal
  certification and does not add an automatic download-once/no-refund rule.

Primary implementation references:
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[sending](https://resend.com/docs/api-reference/emails/send-email),
[retrieving delivery state](https://resend.com/docs/api-reference/emails/retrieve-email),
[Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Deployments

Pending this slice's Preview/production acceptance. Prior production remains
`dpl_4hQNe5XcwtEx5SipwmYLkHdmcgXV` / source `ffc112b` until verified promotion.
