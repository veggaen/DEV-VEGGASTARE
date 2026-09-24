# Transactional copies and scheduled-job protection — 24 September 2026

Status: implementation verified locally; Preview/production deployment acceptance
is recorded below as it completes. The existing Resend key is **sending-only**:
an actual synthetic email with attachment was accepted, but domain/history reads
return `restricted_api_key` (401). The initial inference that the credential was
invalid was incorrect and was corrected before requesting a replacement. Human
inbox delivery remains unverified. No customer email has been sent as part of
these tests. Seller review UI and full-agreement/legal review are
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
  Such a receipt becomes `ACCEPTED_UNCONFIRMED`, not failed or delivered, and
  polling stops without resending. A verified delivery webhook is follow-up work.
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
- Payment/demo/cron units: **215 passed**, seven opt-in DB/provider cases skipped
  in the ordinary run. Final standalone strict TypeScript and touched lint pass.
- Isolated real Postgres outbox tests: **3 passed** (7.44s). Eight concurrent enqueues
  produce one immutable record; rollback produces none. Eight competing workers
  send once and then use GET, not another send, to confirm a fixture delivery.
- The initial real concurrency test exposed Prisma's emulated empty-update
  upsert race. A per-source transaction advisory lock fixed it; the original
  concurrency assertion was retained and passes. The first two cases use a
  fixture transport. The third sends through the real restricted Resend key to
  `delivered+veggat-outbox-qa@resend.dev`, verifies `ACCEPTED`, then verifies
  `ACCEPTED_UNCONFIRMED` on the restricted GET. Only one POST is made by that case.
  The disposable random QA schema was removed after the test; no public rows changed.
- A separate synthetic attachment probe received HTTP 200; its exact replay with
  the same idempotency key returned the same message ID. These are Resend's official
  simulation recipients, not evidence of delivery to a real person's inbox.
- Local browser: **3/3 passed** (8.9s). Public/forged cron calls get 401; draft
  recovery, malformed-200 handling, real demo acknowledgment downloads and
  request replay remain correct. No paid order/credit status changed.
- Scroll/44px/no-horizontal-overflow checks cover 360, 390, 844 landscape, 768,
  1280 and 2560. 390/1280 screenshots reviewed. Real Chrome desktop verified the
  retained receipt and no-email demo wording. Its viewport override did not apply
  (actual width 2498); it was reset, not counted as mobile verification.

## Configuration and release boundaries

- `RESEND_API_KEY` in Vercel accepts sends from `Veggat-Orders@veggat.com` with
  the attachment to Resend's official labelled test address. Domain/history reads
  are forbidden because of its sending-only scope. Do not replace or broaden that
  key based on the 401 alone. Resend sign-in remains open for later delivery-event
  configuration; no new key was created or exposed in chat.
- Following those checks, `TRANSACTIONAL_EMAIL_ENABLED=true` is configured in
  Preview/Production for the next deployments. Preview's allowlist contains only
  the official labelled test address. Local still uses a fake key and sends none.
  Human inbox delivery must not be claimed from the simulated test address.
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

The first Preview candidate `dpl_GQVeXu4iRuYUjntxTa7Woinm3cuS` did not deploy:
strict TypeScript caught the inferred empty-header union in the newly added
cron browser test. It was added after the initial local build. Explicitly typed
header cases fix the test; local strict checking is repeated before redeploy.
No production promotion occurred from that failed candidate.

Candidate `dpl_BsoPcwUUNpHNs8TJpLHHMScbKrxf` (source `d22d205`) built successfully
but was superseded before stable alias/promotion by the sending-only permission
handling. It is not the active release.

Pending this slice's Preview/production acceptance. Prior production remains
`dpl_4hQNe5XcwtEx5SipwmYLkHdmcgXV` / source `ffc112b` until verified promotion.
