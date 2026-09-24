# Transactional copies and scheduled-job protection — 24 September 2026

Status: guarded outbox deployed and verified locally, in Preview and on
www.veggat.com. The existing Resend key is **sending-only**:
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
- Final-source local browser: **3/3 passed** (8.1s), final configured Preview
  **3/3 (18.4s)** and production **3/3 (28.8s)**. Public/forged cron calls get 401; draft
  recovery, malformed-200 handling, real demo acknowledgment downloads and
  request replay remain correct. No paid order/credit status changed.
- Scroll/44px/no-horizontal-overflow checks cover 360, 390, 844 landscape, 768,
  1280 and 2560. 390/1280 screenshots reviewed. Real Chrome desktop verified the
  retained receipt and no-email demo wording. Its viewport override did not apply
  (actual width 2498); it was reset, not counted as mobile verification.
  Final live 390/1280 screenshots were reviewed in light mode; real Chrome
  local dark-mode receipt was scrolled through to the footer without overlap.
- Authenticated email-worker probes return **200**, private/no-store,
  `{ processed: 0, configured: true }` on final Preview and production. Read-only
  database checks before activation and after live demo QA found zero outbox
  records and 48 applied migrations. No historical customer mail was queued.
  These database diagnostics used certificate-verified TLS; they do not change
  or certify the application's pre-existing database TLS configuration.
- Final production health is **200 / healthy**, DB latency 225ms in the observed
  warm probe. This single check is not a performance percentile or speed claim.

## Configuration and release boundaries

- `RESEND_API_KEY` in Vercel accepts sends from `Veggat-Orders@veggat.com` with
  the attachment to Resend's official labelled test address. Domain/history reads
  are forbidden because of its sending-only scope. Do not replace or broaden that
  key based on the 401 alone. Resend sign-in remains open for later delivery-event
  configuration; no new key was created or exposed in chat.
- Following those checks, `TRANSACTIONAL_EMAIL_ENABLED=true` is configured in
  the current Preview/Production deployments. Preview's allowlist contains only
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
[Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
[scoped environment creation](https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables).

## Deployments

The first Preview candidate `dpl_GQVeXu4iRuYUjntxTa7Woinm3cuS` did not deploy:
strict TypeScript caught the inferred empty-header union in the newly added
cron browser test. It was added after the initial local build. Explicitly typed
header cases fix the test; local strict checking is repeated before redeploy.
No production promotion occurred from that failed candidate.

Candidate `dpl_BsoPcwUUNpHNs8TJpLHHMScbKrxf` (source `d22d205`) built successfully
but was superseded before stable alias/promotion by the sending-only permission
handling. It is not the active release.

Source **`82727bd`** built as `dpl_E7VoufJVpW2e8f1Y8oRp326vnXfg` and passed
three browser checks, but the positive authenticated worker probe exposed missing
Preview settings. The earlier CLI `env add preview --yes` returned exit 0 while
stopping at its optional branch-selection prompt; treating that exit as a saved
setting was incorrect. Production values were independently present. The Preview
values were subsequently created using individual documented API JSON objects
and independently listed by ID/target/type. No key or secret was printed.
Candidate `dpl_F29MMHjGYAvwWF6HFBQbCx6CJ8td`, started before that correction,
was never assigned the stable alias. No production promotion occurred until the
corrected Preview deployment and positive probe passed.

Final Preview **`dpl_4gNdz6fajyZepxjmRdBwUhr9ikWx`**, source **`82727bd`**,
is READY at `https://dev-veggastare-pmwuk5uw4-v3ggas-projects.vercel.app` and
assigned to the stable Showcase Preview alias. Its build selected the isolated
`ep-jolly-smoke-abgwws6k` Neon branch, with 48 migrations and none pending.

Production **`dpl_5yuYw7bESbW9aW6AWsSjM6xFmsrr`**, source **`82727bd`**,
is READY at `https://dev-veggastare-ev41bx7h2-v3ggas-projects.vercel.app`.
Its build selected `ep-orange-wildflower-abp9cs2l` and applied only the additive
`20260924000700_transactional_email_outbox` migration. After Preview acceptance
and healthy candidate response it was promoted; `vercel inspect www.veggat.com`
resolves this exact deployment. No real purchase, paid withdrawal, refund or
customer email was submitted by these acceptance checks.

Production rollback: **`dpl_4hQNe5XcwtEx5SipwmYLkHdmcgXV` / `ffc112b`**.
The additive outbox table can remain if application code is rolled back. Do not
delete retained purchase correspondence or requeue accepted messages blindly.
Historical migration replay, owner Live money acceptance, complete legal
agreement delivery and human-inbox confirmation remain separate release gates.
