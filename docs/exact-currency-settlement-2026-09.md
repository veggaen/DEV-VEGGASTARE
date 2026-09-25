# Exact-currency credit purchases — implementation in progress

Status: **PARTIAL, exact-price entry not activated or deployed**. Production still
charges server-priced NOK and treats a typed budget as a maximum. Keeping `100`
in that input did not fulfill the request to actually buy for USD 100.00.
The new policy is the first implementation step toward that requirement, not a
claim that the customer journey is complete.

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

The new store is not connected to any HTTP route. Its future callers must enforce
authentication, ownership, same-origin checks, durable rate limits and private
response headers. It does not contact PayPal, send email or grant entitlements.
The migration has been applied only to disposable empty test schemas, not the
Preview public schema or production. Prisma's generated client and the updated
cart helper require the additive migration before running a new application
build; do not deploy this intermediate commit against the old public schema.

## Payment and receipt integration (not deployed)

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

Actual quote/input routes and storefront/cart UI remain incomplete. Connect and
verify those before enabling any v2 customer purchase. This
integration is not evidence of a real PayPal native-currency Sandbox capture.
The transport/proof contracts were rechecked against PayPal's
[capture-order reference](https://developer.paypal.com/api/orders/v2/orders-capture),
[capture-details reference](https://developer.paypal.com/api/payments/v2/captures-get)
and [refund-details reference](https://developer.paypal.com/api/payments/v2/refunds-get).

## Currency-aware reporting and verification (not deployed)

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
  Existing Playwright report fixtures now include all six currencies; their new
  browser run remains pending the migrated local application build.

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
- No Live payment, refund, credit, email, secret, billing or deployment change.
  No new browser acceptance is claimed: the store is not imported by an active
  route yet. Existing production remains `92c5ac7`.

## Next implementation and activation gates

1. Persistence and isolated PostgreSQL verification are implemented. Keep them
   inactive until the dependent payment, receipt and report paths below are
   currency-aware; then apply the additive migration to isolated Preview before
   building/running the new Prisma client. Apply to production only with the
   verified compatible release. Never backfill/reprice old NOK orders.
2. Create/capture/refund, native Payment amounts, receipt/confirmation, grouped
   owner financial reports, company checkout counts and verification evidence
   are implemented with v1 compatibility tests. An exposure valuation is not revenue. Retain
   verified webhook signatures, unique capture grants and revocation locks.
3. Connect product/basket/cart/checkout auto inputs to the server quote. Persist
   spend intent; currency changes require a new quote. Show one native fiat total
   plus optional crypto estimate, retain editable drafts and lock payment during
   a pending/failed/expired quote. Never round a NOK-derived estimate to fake an
   exact foreign-currency charge. The existing display helper alone is not enough.
4. Local :3000 then isolated Preview: exact USD 100, NOK 1000, count mode, mixed
   cart, expiry, currency switching, cross-tab edits, old-order recovery, denied
   forged inputs, capture/refund replay, and 390/1280 plus requested layout sizes.
   Sandbox captures/refunds must exercise native-currency proofs end to end.
5. Verify the merchant's foreign-currency receiving behavior. Deploy only after
   the dependent money/report paths are consistent. Any new Live purchase remains
   an explicit owner-reviewed action, not part of these read-only checks.
