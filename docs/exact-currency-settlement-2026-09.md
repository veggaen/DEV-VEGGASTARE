# Exact-currency credit purchases — implementation in progress

Status: **PARTIAL, exact-price entry deployed to isolated Sandbox Preview only**. Production still
charges server-priced NOK and treats a typed budget as a maximum. Keeping `100`
in that input did not fulfill the request to actually buy for USD 100.00.
The local and Preview customer journeys now use native-currency server quotes. Real Sandbox
capture/refund acceptance and production activation are still required.

## Required end state

- The global fiat choice determines a new checkout's actual PayPal currency.
  Parentheses remain the selected crypto estimate, never a second fiat price.
- A customer chooses whole credits OR an exact spending amount. Edits apply
  automatically, and payment waits for the server-confirmed quote.
- An exact USD 100.00 credit purchase stays USD 100.00 through PayPal, capture,
  receipt, email, refund and reporting. A mixed cart adds the separate file line;
  the amount input describes credit spending, not the whole cart total.
- Expired/changed quotes require review; retries and historical payments keep
  their original amounts, currency, credits and agreement. No silent repricing.

## Implemented boundary

`frontend/lib/payments/settlement-*.ts` implements:

- Bounded integer minor units and decimal-string/rational FX math. No binary
  floating-point rounding of an entered amount, exponent notation or silent
  currency fallback. Supports the existing NOK/USD/EUR/GBP/SEK/DKK choices only.
- Strict selection of known SKUs, one of each. The caller can select credits or
  desired spend, but cannot set price, FX, granted credits, fee or model cost.
- An exact-spend pack contains the largest whole-credit amount within that exact
  price. The final charge is the entered amount, not the smaller count-mode
  price. This difference is below the next credit's price and must be clear in
  the final quoted pack. The 10-credit starter stays a direct preset; arbitrary
  spends below the 100-credit minimum or above the maximum are rejected, never
  used to charge extra for the starter or capped maximum.
- Frozen original currency/line money and a separately named, upward-rounded
  NOK **exposure valuation**. Valuation is for the daily cap, never a receipt,
  PayPal amount or claim of cash received in NOK.
- A fresh server-only ECB/Frankfurter reader with pinned endpoint, timeout,
  bounded body, in-flight deduplication and five-minute cache. No fallback or
  stale display rates. Publication dates, future timestamps and missing rates
  fail closed. New quotes expire within ten minutes, and earlier at UTC midnight,
  FX freshness expiry or pricing-review expiry.
- Purpose-separated HMAC attestations bound to user, LIVE/SANDBOX/DEMO and a
  server-read cart fingerprint. Tokens expire and reject changed money, grants,
  actor, cart and environment. The random quote ID must become a unique database
  request identity; a signature alone does not provide replay protection.
  They are signed, not encrypted: pass only in an authenticated same-origin POST
  body, never a URL, telemetry field or log. No token can replace app sign-in.
- PayPal item serialization and independent capture/refund proof validators
  compare **both currency and exact minor amount**, plus internal order, PayPal
  order, merchant and capture bindings. Partial adjustments retain review rather
  than guessing which line was refunded. These helpers do not make a payment,
  verify a webhook signature themselves, or grant/revoke entitlements.
- Transactional cart-intent storage and preparation in `settlement-store.ts`.
  A signed quote ID becomes a unique persisted request identity; concurrent
  retries return the same frozen order, including after expiry or cart removal.
  New requests recheck cart fingerprint, expiry, explicit consent, listing/file
  readiness, reviewed model costs, two-attempt limit and combined NOK exposure.
  Resuming a prepared quote is not permission to capture an expired payment.
- Additive migration `20260925190000_exact_settlement_quotes` separates native
  `totalMinor`/`refundedMinor` from `totalOre` exposure. SQL constraints reject
  mismatched native amounts/currencies, half-defined cart intent and duplicate
  quote IDs. A trigger preserves original v2 quote, agreement, request IDs and
  established provider identifiers. Existing v1 NOK records remain unchanged.
  V2 refunds must not write a native amount into the legacy `refundedOre` field.
- Cart preparation locks the parent and existing child rows. Tests with real
  foreign keys confirm that concurrent legacy edits/deletes/inserts wait until
  the frozen snapshot is persisted. Both count-mode cart APIs use the shared
  helper that clears old spend intent. This follows PostgreSQL's documented
  [row-lock semantics](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).

The store is connected to bounded HTTP routes in the local build. Public price
estimates are unsigned; authenticated cart quotes read the actor's own cart and
return a short-lived attestation. Credit-intent edits require the current item
revision. Strict input schemas reject caller prices, rates and owner IDs. All
three routes enforce same-origin checks, durable edit limits and private/no-store
responses; edits do not consume the separate payment-attempt bucket. Impersonated
sessions cannot write. Demo sessions can edit their own cart, not create paid orders.

The additive migration is now applied to the **isolated Preview public schema**,
after a preflight verified that it was the only pending migration and existing
legacy rows were compatible. Production is unchanged. New builds still require
this migration before their first application run; do not deploy this intermediate
commit against the old production schema.

## Payment and receipt integration (isolated Preview only)

- `checkout-money.ts` validates each original v1 NOK or v2 exact-currency record
  and returns native cash separately from exposure. It does not reprice old
  products, change their names or refresh historical FX. Half-upgraded or
  internally inconsistent records fail closed.
- The existing PayPal transport now serializes v2 purchase units in the quoted
  currency. Capture verifies native amount/currency and all order/merchant
  bindings before fulfillment, then verifies the fresh record again under the
  fulfillment lock. Existing recovery still reuses the original request/capture
  identities and original capture window; it never makes a replacement purchase.
- Before capture and fulfillment, order owner, currency, total and exact line
  contents must match the paid quote. An extra/substituted order line cannot gain
  access to another private file. File availability failure rolls back grants,
  tokens, payment and confirmation; later reconciliation can complete once the
  original files are available, without charging again.
- Grants, native `Payment` fields, download tokens and immutable confirmation
  outbox records share the existing transaction. V2 cart cleanup matches the
  original row ID, revision, count and spend; a re-added next cart remains intact.
  V1 cleanup will not erase a newly selected exact-spend budget. The old creation
  endpoint refuses a cart with exact-spend intent instead of silently charging
  a derived NOK count price.
- The verified-webhook adjustment reconciler binds both legacy and v2 refunds
  to their original currency. V2 writes `refundedMinor`, never `refundedOre`.
  Partial refunds still hold the entire entitlement for review; replay/full
  follow-up revokes once. Already-spent credits become a credit adjustment, not
  a negative available balance or another card charge. No new refund is initiated.
- The receipt reads native amounts/lines from the original quote and supplies
  their currency to the existing fiat/crypto formatter. Its original-payment
  disclosure, downloadable confirmation and email attachment retain native cash,
  not NOK exposure. Server-rendered tests cover USD 100.00 and its USD refund
  with ETH parentheses. The receipt layout itself is unchanged in this slice.

Quote/input routes and the storefront/cart UI are verified locally and on isolated
Preview. This integration is not evidence of a real PayPal native-currency Sandbox
capture. Production activation still requires that acceptance.
The transport/proof contracts were rechecked against PayPal's
[capture-order reference](https://developer.paypal.com/api/orders/v2/orders-capture),
[capture-details reference](https://developer.paypal.com/api/payments/v2/captures-get)
and [refund-details reference](https://developer.paypal.com/api/payments/v2/refunds-get).

## Currency-aware reporting and verification (isolated Preview only)

- `checkout-reporting.ts` shares read-only, parameterized capture/money predicates
  across the owner report, company counts and payment-verification evidence.
  Original v1 NOK cash and v2 native cash are distinguished explicitly; partial
  upgrades, missing provider bindings and mismatched order owners are excluded.
- Owner totals contain at most six currency groups. Each has its own capture
  count, gross amount and refunds/reversals; there is no fabricated cross-currency
  grand total or conversion of exposure into revenue. Existing NOK and exact NOK
  combine in one NOK group. Aggregates outside safe integer bounds fail closed.
- The private report validates currency, unique groups, counts and refund bounds.
  Its concise panels use semantic lists, tabular figures and existing theme tokens;
  details stay behind keyboard-accessible disclosures. No access/refresh/identity
  safeguards were removed. Review followed the
  [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
- Company paid/adjusted/review counts now recognize all six currencies. Payment
  trust requires a positive unadjusted Live capture, matching owner, nonempty
  provider IDs and a completed order. A native refund, even with a stale completed
  flag, cannot earn payment trust. Sandbox/Demo never earn Live-payment trust.
- Real disposable-schema tests cover mixed/legacy/native amounts, all six
  currencies, partial/full/reversed payments, owner mismatches, corrupt money and
  missing proof. These tests use synthetic records, never production customer rows.
  Playwright report fixtures include all six currencies. Their local light/dark
  browser runs pass; hosted acceptance is pending a complete compatible release.

## Draft commercial policy (not Live pricing)

NOK prices and the 9 NOK starter stay unchanged. Foreign-currency quote prices
include a 5% merchant currency-price allowance and a conservative adjustment for
any fixed receiving fee above the NOK allowance. The reference FX is retained
unmodified; these are included in the final product price, not a hidden PayPal
surcharge. Exact-spend mode still charges exactly the entered amount and adjusts
the credit count accordingly.

The margin guard retains reviewed provider ceilings, a failure allowance, tax
reserve and 15% minimum modeled contribution. It additionally reserves 4% for
foreign currency costs and uses the fixed fee of the received currency. A first
test run demonstrated that 5% alone did not cover the smallest EUR/DKK packs;
the fixed-fee difference is now covered rather than weakening the guard. This
is conservative planning, not guaranteed profit or actual invoice accounting.

Sources checked 25 September 2026:
[PayPal supported currencies and receiving preferences](https://developer.paypal.com/api/codes/currency/),
[Norway merchant fees](https://www.paypal.com/no/business/paypal-business-fees?locale.x=en_NO),
and [Frankfurter provider-specific rate documentation](https://frankfurter.dev/).
The six supported currencies use two decimals. Merchant receiving preferences
can leave a foreign-currency payment pending; do not grant on approval/pending.
The fee policy expires with the existing 24 October review deadline.

## Verification so far

- 278 focused tests pass across eight files, including existing NOK pricing and
  PayPal proof/transport regression tests. Each supported credit count was checked
  against the modeled margin for all six fixed FX fixtures.
- One opt-in integration test passed using actual fresh public ECB rates to
  generate exact 100.00 quotes in all six currencies. This read contains no
  user data and makes no PayPal request.
  The quote-foundation invocation passed **279/279 across nine files**, no skips.
- The persistence slice's combined invocation passes **316/316 across eleven
  files**, no skips: real isolated PostgreSQL preparation/constraints/concurrency,
  the fresh public FX check, quote/token/proof/transport, agreement, pricing and
  shared cart-policy regressions. Includes exact USD 100.00/NOK 1000, mixed lines,
  replay after expiry/cart removal, different signed money under the same ID,
  actor/environment isolation, unsafe cost review, daily caps, stale edits,
  expiry after lock waits and no grant at preparation. Test schemas clone table
  structure only, never customer rows; their synthetic records are removed with
  the schema afterward. No public database schema was changed.
- Touched ESLint and full TypeScript pass. A widened test-consent literal was
  fixed before the final typecheck; the initial margin failures remain documented
  above, not counted as passes.
- The payment integration's final combined invocation passes **468/468 across
  twenty files**, no skips. This includes the fresh public FX check and real
  isolated PostgreSQL transactions with injected PayPal responses for all six
  native currencies: capture, original confirmation and refund. Mixed-cart
  concurrent captures create one purchase grant, two private file tokens and
  one skipped-outbox packet; idempotency keys stay identical. Tests cover wrong
  currency/amount, substituted lines, missing-file rollback, cart preservation,
  concurrent refund replay, partial/full refunds, refund-before-completion,
  spent-credit adjustment and complete legacy NOK capture/refund compatibility.
  `.invalid` fixture recipients are `SKIPPED`; no message is sent. Table shapes
  are cloned without customer rows; the fixture User table contains only the
  minimal recipient fields, not credentials or real identities.
- The first wider run found stale receipt fixtures without stored quote money
  and an eager factory default incompatible with prepare-only mocks. Fixtures
  now reflect real stored records, and the runtime wrapper creates dependencies
  only when completion is called. Touched lint and full TypeScript pass after
  these fixes; the failed intermediate run is not counted as a pass.
- The reporting integration's combined run passes **607/607 across twenty-six
  files**, no skips. Actual capture/refund factories also feed the real SQL report
  in the migrated disposable schema for all six currencies. A separate minimal
  schema tests corrupt/half-upgraded records that the migration would reject.
  These are mocked provider proofs, not real Sandbox payments. Full TypeScript
  and touched ESLint pass; updated browser fixtures are not yet executed.
  After tightening stored quote-ID/fingerprint shape checks, the report/company/
  verification follow-up also passes **138/138 across six files**, no skips.
- The HTTP integration's combined run passes **725/725 across thirty-one files**,
  no skips. Its first wider run exposed a genuine concurrent-capture retry race:
  another request could finish before a delayed claim and incorrectly receive
  `ORDER_CHANGED`. The response now accepts only an already-completed record with
  matching owner/environment/provider bindings and valid order/proof. A deterministic
  delayed-claim database test confirms one provider call and one ledger grant.
- After applying the migration to isolated Preview, the disposable-schema suite
  passes **42/42** again. It reconstructs only its own empty private test schema's
  legacy shape before testing the migration; it never drops public columns.
- Actual local HTTP acceptance passes **2/2**, zero retries/skips: fresh public FX
  quotes in all six currencies, exact USD 100.00/NOK 1000.00, malformed/forged input,
  anonymous and cross-origin denial, own-cart spend persistence, signed quote,
  stale-revision rejection and currency-change rejection. The retained demo's
  original cart intent is restored afterward. No order or payment is submitted.
- Local report UI passes light **2/2** and dark **2/2**, zero retries/skips, with
  six-currency browser-only owner fixtures, actual non-owner API denial, refresh/
  identity-loss recovery, scrolling and widths 360 through 2560. Real Chrome also
  confirms the unchanged legacy receipt at 1280 and 390, scrolling to its footer,
  and no captured console errors. The temporary viewport is restored. This is not
  native-currency checkout UI or real Sandbox capture acceptance.
- Strict production build, touched ESLint and full TypeScript pass. The Python
  runtime is absent, so browser checks use the repository's existing Playwright
  runner. No Live payment, refund, credit, email, secret, billing or deployment
  change. Existing production remains `92c5ac7` and settles in NOK.

## Next implementation and activation gates

1. Persistence and isolated PostgreSQL verification are implemented; the additive
   migration and production-mode local build are verified against isolated Preview.
   The dependent UI is complete and the compatible build is on isolated Preview. Apply the
   migration to production only with the
   verified compatible release. Never backfill/reprice old NOK orders.
2. Create/capture/refund, native Payment amounts, receipt/confirmation, grouped
   owner financial reports, company checkout counts and verification evidence
   are implemented with v1 compatibility tests. An exposure valuation is not revenue. Retain
   verified webhook signatures, unique capture grants and revocation locks.
3. Product/basket/cart/checkout are now connected to server quotes locally.
   The debounced input retains exact spend, atomically saves intent plus computed
   credits, and needs no Update button. Currency changes require explicit review;
   pending, failed and expired quotes disable payment. A possibly accepted payment
   freezes its quote/body for identical retries. Other-tab changes cannot replace
   the displayed selection silently, and paused quotes cannot cross cart/currency
   revisions. Native fiat is distinguished from the optional crypto estimate.
4. Local :3000 then isolated Preview: exact USD 100, NOK 1000, count mode, mixed
   cart, expiry, currency switching, cross-tab edits, old-order recovery, denied
   forged inputs, capture/refund replay, and 390/1280 plus requested layout sizes.
   Sandbox captures/refunds must exercise native-currency proofs end to end.
5. Verify the merchant's foreign-currency receiving behavior. Deploy only after
   the dependent money/report paths are consistent. Any new Live purchase remains
   an explicit owner-reviewed action, not part of these read-only checks.

## Local purchase UI verification — 25 September 2026

- Combined payment/cart/report regressions: **629/629 across 29 files**, no skips.
  A subsequent focused run passes **23/23** after adding cross-tab quote-binding
  validation. PostgreSQL tests use only disposable isolated schemas and mocked
  provider proofs, not real payments.
- Browser checks verify exact USD 100 across product, basket, cart and checkout;
  an intercepted unavailable-payment response retries the identical signed body,
  with edits locked. No order, provider request, allowance or email is created.
- NOK 1000 exact spend, the 10,000-credit preset, explicit currency-change recovery,
  and light/dark checkout layouts are checked at 360/390/844 landscape/768/1024/
  1280/1920/2560. Screenshots are inspected, not just overflow measurements.
- The 10-credit **9.00 NOK** preset also passes its separate product → basket →
  cart → checkout browser run, including a mocked submission and reload. Only
  the isolated demo cart is edited; no payment, order or credits are created.
- Earlier harness failures navigated away before the Add response; tests now
  await the actual cart write. Rapid consecutive runs also reached the existing
  request limit. Limits are unchanged; final runs are spaced. These intermediate
  failed runs are not reported as passes.
- Unexpected network/JSON errors are redacted into actionable buyer messages;
  429 responses request a pause. Refund-adjustment information is retained, but
  does not temporarily claim a zero-credit pack while its quote is loading.
- Real Chrome confirms the signed-in local product, automatic exact USD 100 and
  the balanced purchase workspace, plus a Sandbox file checkout and scrolling to
  its footer at the actual 2498px width, with no horizontal overflow. The attempted
  viewport override did not change this tab's measured width; it is not counted
  as real-Chrome mobile acceptance. Responsive acceptance above is Playwright.
  Existing Resend webhook remains Enabled and
  its recorded test event received HTTP 200; this is not inbox-delivery evidence.
- Design review uses the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
  for labelled inputs, keyboard focus, token surfaces and responsive containment.
  Existing consent wording and payment/grant safeguards are unchanged.
- Production remains `92c5ac7`. No production migration/deployment, new Live
  charge/refund, email, credential or billing change is part of this UI slice.
- Final optimized build, full TypeScript and touched ESLint pass. Local testing
  uses the production-mode build on :3000 with isolated Preview data and Sandbox
  credentials only.

## Hosted Preview acceptance — 25 September 2026

- Runtime `ac784e7` is READY as `dpl_8EhTGTcSg8pMiL3KPPgMBPTwgxpX`, aliased only
  to `dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app`.
  The guarded build verified the isolated Neon host and all 55 applied migrations;
  no migration was pending. Existing Sandbox credentials/webhook were reused.
- Focused hosted browser/API checks pass **5/5**, zero skips/retries, in four
  spaced invocations: exact USD 100 through product/basket/cart/checkout and an
  identical-body payment retry; six-currency HTTP quotes and forged/origin/auth
  denials; revisioned cart edits and currency-change rejection; NOK 1000/10,000
  credits/currency switching with light/dark layout; and the 10-credit 9 NOK pack.
- Payment submissions are intercepted, never sent to PayPal or demo fulfillment.
  Only the retained disposable demo cart is edited and restored. Its session was
  still authenticated, so no new demo identity or allowance was created. Display
  FX in the flexible-layout test is a fixture; server settlement quotes use the
  hosted server's real fresh FX source.
- Inspected hosted screenshots at 390, 1280 and 2560; automated overflow and CTA
  reachability checks cover 360/390/844 landscape/768/1024/1280/1920/2560, including
  a 1024px portrait case. This is responsive browser acceptance, not physical-phone
  keyboard or actual 125% browser zoom acceptance.
- Real Chrome confirms automatic USD 100.00 with no Update button, the balanced
  credit-product workspace, and signed-in file checkout showing USD 3.21 plus
  ETH estimate and an explicit Sandbox badge. Actual viewport: 2498 × 1263.
  The inner checkout scroller reaches its 110px bottom; no horizontal overflow
  or captured console errors. No consent box or payment button was submitted.
- Test allowlists now exclude production from these cart-editing checks. Touched
  ESLint, full TypeScript and the hosted optimized build pass.
- Read-only verification confirms production still points to
  `dpl_3GCyDg5BuzBghdjkSnhKut2J7cdu` (`92c5ac7`). No production migration,
  charge/refund, email, key, grant, limit or billing change occurred.
- Resend remains signed in; the existing enabled webhook has a recorded HTTP 200
  bounce event. The prior Live purchase email remains ACCEPTED_UNCONFIRMED with no
  delivered timestamp. Neither signal proves inbox delivery; no message was resent.
- Next: actual native-currency Sandbox create/capture/refund and merchant receiving
  behavior. The retained password QA buyer has already used today's two attempts
  on cancelled orders; limits were not reset or weakened. Hosted quote/UI success
  must not be described as a successful PayPal capture.
