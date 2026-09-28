# Buyer notices and retainable acknowledgments — 24 September 2026

Follow-up: the [guarded transactional outbox](transactional-email-acceptance-2026-09.md)
is now deployed. The download-only/email statements below describe this earlier
slice; demos remain download-only, and human-inbox/full-agreement delivery remains
unverified. See the [scoreboard](production-scoreboard.md) for current deployment authority.

## Scope and boundaries

The verified checkout receipt now exposes **Withdraw from this purchase** and
**Report a purchase problem**, with an explicit second confirmation, optional
message, keyboard focus, draft retention on failure, and support contact fallback.
An existing defect report does not prevent a separate withdrawal notice. Pending
requests, seller responses and original downloadable acknowledgments remain on
the receipt, including after payment status changes. Demo orders explicitly say
no payment was collected; the flow does not create a payment or refund.

This is **not** a rule denying refunds after a download. Nor does sending a notice
establish that a refund is due or that money moved. The existing verified PayPal
reconciler alone handles revoked credits/downloads. An original submitted message
and UTC timestamp are retained; review status and seller notes do not rewrite the
downloadable acknowledgment. Raw asset tokens are not included.

POST validates strict input, origin, authenticated ownership and durable rate
limits. A transaction takes the same order lock as payment reconciliation and
serializes pending requests of the same kind. Identical active retries return the
original request; a conflicting message cannot overwrite it. Another pending
request type does not block withdrawal. Closed requests can be followed by a new
notice; this is not a promise of eternal exactly-once delivery for every retry.
The acknowledgment endpoint is buyer-only, throttled, private/no-store, UTF-8
plain text, `nosniff` and attachment-only. No new schema or migration is needed.

The demo mutation allowance is exact `/api/returns`; `/api/returns/:id` seller
review and payment mutations remain blocked. The route separately verifies that
the demo actually owns the completed order. No account or financial caps changed.

## Verification

- Touched ESLint and strict production-style local build/TypeScript pass.
- Payment/demo units: **190 passed**, four opt-in tests skipped in this ordinary
  run. The three new concurrency cases passed separately against isolated Neon.
- Real PostgreSQL: eight concurrent notices create one pending row; conflicting
  messages remain unchanged; a defect notice and withdrawal can coexist; replay
  after an order cancellation retrieves the original; a foreign buyer is denied.
  Only a random `qa_buyer_requests_*` schema was created and removed. No public
  data, credits or financial transactions were touched. Initial QA harness runs
  exposed enum-cast incompatibility in the cloned tables; corrected enum copies
  and matching column types pass all three cases.
- Local Playwright: **2/2 (6.9s)**. The first UI journey intercepts request writes
  to test failure/retry/focus and geometry at 360, 390, 844 landscape, 768, 1280
  and 2560. Screenshots at 390/1280 were visually inspected. The second uses an
  existing, explicitly unpaid demo order: two actual concurrent requests return
  the same ID, anonymous acknowledgment access fails, a real browser TXT download
  matches the original, and reloading keeps the notice and original order status.
- The initial real demo POST was blocked by the demo guard; the exact scoped
  allowance was added and tested, then the local build and both journeys rerun.
- Real Chrome at 390px submitted a clearly labelled free-demo notice on order
  `cmuevx0is0006e4t54861rob5`; the UI retained request
  `cmueyx39n0001gkt5xvutyc33`, its UTC timestamp and no-refund notice. The form and
  acknowledgment were visually reviewed in dark mode and viewport overrides reset.
  Its download link was clicked once, but the expected Downloads artifact was not
  found and Chrome's download-manager URL was blocked by browser policy. No
  workaround or repeated click was attempted. The independently verified actual
  TXT transfer above is Playwright evidence, not a claim about this Chrome file.

## Not claimed

No Live refund or paid withdrawal was submitted by QA. Owner Live micro-purchase
acceptance remains pending. Purchase and request confirmations are downloadable,
**not emailed**. Transactional email/outbox delivery, the complete durable sales
agreement/withdrawal form, seller review operations, and Norwegian legal review
remain separate work. This slice does not assert compliance with the new §20a
electronic withdrawal provisions or their commencement date.

The content/services distinction and conditions for losing withdrawal rights are
discussed in the [Norwegian legislative explanation](https://www.regjeringen.no/no/dokumenter/prop.-50-ls-20222023/id2966742/?ch=8).
The new electronic function is described in [Lovvedtak 85, section II](https://www.stortinget.no/no/Saker-og-publikasjoner/Vedtak/Beslutninger/Lovvedtak/2025-2026/vedtak-202526-085/?m=0).
These sources inform safeguards; they do not certify Veggat's implementation.

## Deployment

Source `b09876d` is deployed to Preview as `dpl_29j9DctKWFe4ypvyREQX1qpfgyyK`:
`https://dev-veggastare-qkmbhtadt-v3ggas-projects.vercel.app`, with the stable
Showcase Preview alias assigned. The build selected the isolated Neon endpoint
`ep-jolly-smoke-abgwws6k`, reported 47 migrations and none pending, and passed
strict TypeScript. Both targeted Playwright journeys pass **2/2 (25.5s)** on the
deployed alias, including an actual unpaid-demo notice and private TXT download.
Preview rollback: `dpl_BDzoouNqWdLsSxrZcqjWv7mFr895` (source `6df9a4c`).

A final response-validation follow-up rejects malformed/non-JSON HTTP 200 replies
and mismatched order/reason records without clearing the draft or announcing a
saved notice. Its browser regression explicitly supplies a sign-in HTML response
between the service-failure and valid-response cases. The initial production
candidate `dpl_3Ry4zH9dpjT1K7AHHpaGmzstQooS` is not promoted; production promotion
waits for the corrected source and repeat local/Preview verification.

Corrected source **`ffc112b`** passes strict local build/TypeScript, the 190 unit
checks, **2/2 local browser checks (7.5s)** and **2/2 Preview checks (24.4s)**.
Current Preview is `dpl_H6SpsRxQ1cBpad1zScwBA1eV9Zfh` at
`https://dev-veggastare-d2zbvb0ts-v3ggas-projects.vercel.app`, assigned to the stable
Showcase alias. The first Preview above is superseded, not the current target.

Production **`dpl_4hQNe5XcwtEx5SipwmYLkHdmcgXV`**, source **`ffc112b`**, is READY at
`https://dev-veggastare-h3v6bhvi6-v3ggas-projects.vercel.app` and was promoted only
after corrected Preview acceptance and healthy candidate response. `vercel
inspect https://www.veggat.com` resolves this exact deployment. Both focused
journeys pass **2/2 live (24.3s)** using the existing app-issued demo identity,
including the real private acknowledgment download. No paid agreement, capture,
refund or provider call was submitted. Production selected
`ep-orange-wildflower-abp9cs2l`, with 47 migrations and none pending. Post-release
health is healthy (99ms database latency on the sampled warm request).

Rollback production: `dpl_9bGoFC8LBKDb4ZyLn6iTij3mMsjA` / source `6df9a4c`.
No schema rollback is needed. Local :3000 runs the same corrected source with
isolated Preview data and Sandbox credentials only. Owner Live checkout and
PayPal login remain handoffs; the real-Chrome demo acknowledgment and Preview AI
result are retained. Email delivery and seller review operations are next, not
implied complete by these buyer-side checks.

## Files changed in this slice

- `frontend/app/api/returns/route.ts`
- `frontend/app/api/returns/[id]/acknowledgment/route.ts`
- `frontend/app/checkout/receipt/[id]/page.tsx`
- `frontend/components/checkout/purchase-support.tsx`
- `frontend/lib/payments/create-return-request.ts`
- `frontend/lib/payments/return-request.ts`
- `frontend/lib/payments/return-acknowledgment.test.ts`
- `frontend/lib/payments/return-request.database.test.ts`
- `frontend/lib/payments/returns-security.test.ts`
- `frontend/lib/payments/showcase-receipt.test.ts`
- `frontend/lib/demo-policy.ts` and `frontend/lib/demo-policy.test.ts`
- `frontend/e2e/suite.spec.ts`
- This acceptance record, `docs/production-scoreboard.md`,
  `docs/integrated-release-2026-09.md`, and `docs/checkout-delivery-record-2026-09.md`
