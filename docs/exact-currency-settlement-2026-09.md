# Exact-currency credit purchases — implementation in progress

Status: **PARTIAL, not connected to checkout or deployed**. Production still
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
  The final combined invocation passed **279/279 across nine files**, no skips.
- Touched ESLint and full TypeScript pass after fixing a literal-inference issue
  in the cart-fingerprint test. The initial four margin failures are documented
  above, not counted as passes.
- No live payment, refund, credit, email, secret, migration, billing or deployment
  change. No new browser acceptance is claimed: these helpers are deliberately
  not imported by an active route yet. Existing production remains `92c5ac7`.

## Next implementation and activation gates

1. Add nullable cart spend intent and separate native amount/refund fields on
   checkout attempts, preserving every legacy NOK record. Persist the immutable
   quote and agreement atomically. Re-read/fingerprint the cart inside the same
   serialized prepare transaction, enforce current price review and reuse quote
   ID as the unique request identity. The daily cap must sum frozen NOK exposure,
   not mixed native currency units. Cross-tab edits and replay need real isolated
   PostgreSQL tests before enabling this path.
2. Route v2 create/capture/refund through the new proof boundary while preserving
   v1 NOK orders. Continue signature verification and idempotent grants/revocation.
   Record native Order/OrderItem/Payment amounts. Original receipts, confirmation
   attachments, seller/admin reports and refunds must group by currency rather
   than label converted values as cash. An exposure valuation is not revenue.
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
