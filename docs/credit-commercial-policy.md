# Credit product: decisions and remaining commercial gates

Reviewed 23 September 2026 against the existing implementation and the supplied
Grok conversation. That conversation is advice, not a specification or a pricing
source. This document does not promise zero provider leakage or guaranteed profit.

## Keep the useful safeguards

- Sell Veggat functionality, not API keys or an unrestricted provider proxy.
- Integer credits; server-owned model prices; reserve the full advertised message
  price before provider work. A customer with one credit cannot start a two-credit
  message. Do not substitute a rough character count or a mid-stream cutoff for
  that admission check.
- Bound every supported meter: text input/history, output including reasoning,
  duration, daily attempts and platform spend. Tools, attachments, agents and
  automatic retries are not enabled in platform-funded text chat.
- Two in-flight generations per account across tabs and replicas, including free
  models and BYOK. Reject before incrementing counters or reserving funds.
- Verified PayPal server capture/signature-verified reconciliation only. Unique
  purchase/capture and ledger identities prevent duplicate delivery.
- Separate LIVE/SANDBOX/DEMO credit accounts, encrypted BYOK, nonnegative available
  balances, and auditable refund adjustments for previously spent refunded credits.

## Do not copy these parts of the advice

- Stripe-specific fees and events: this implementation uses PayPal Orders v2.
- Guessed model names/rates or a blanket claim that provider budgets are merely
  alerts. [OpenAI hard spend limits](https://developers.openai.com/api/docs/guides/spend-limits)
  can stop requests, but enforcement can lag; alerts are a separate facility.
- Reserving only an initial output chunk and hoping cancellation stops billing.
  The complete server output allowance is covered before the request starts.
- Double-subtracting held credits. Here the available balance already decreases
  when a reservation is created; subtracting outstanding holds again is wrong.
- Quietly billing an estimated token charge after an error. Veggat currently sells
  a **flat, displayed price per successful message**, not exact token metering.
  Failed/cancelled requests refund the user's credits once, while retaining the
  full provider budget reservation. This intentionally leaves a bounded platform
  loss allowance, not a claim that interrupted provider work is free. Changing
  this policy requires explicit copy, settlement telemetry and regression tests.
- Inventing invoice-level profit from reserved ceilings. Cash receipts, unused
  credit liability, billed user credits, conservative provider reservations and
  actual provider invoices are different quantities.
- Building agency wallets, automatic refill or new tool/agent features before the
  basic paid journey is verified. No automatic card charges are introduced.

## Custom credit pricing and release guard

Production currently remains on the old **100 credits for 39 NOK** SKU. The new
custom-credit slice supports every whole amount from **100 through 1,000**;
it is under local/Preview acceptance, not yet promoted to production. The cart
stores `creditAmount` separately from quantity (always one credit line). Null
retains the meaning of an existing 100-credit cart. Only one credit line may
coexist with the separate digital-file product in an order.

Prices are calculated in integer ore on the server, never supplied by the
browser. Progressive marginal discounts avoid price cliffs: first 100 credits
at 39 ore each, next 400 at 5% off, remaining credits at 10% off; round the final
sum up once to an ore. Examples: 122 = 47.16 NOK; 555 = 206.51 NOK; 1,000 =
362.70 NOK. Selected fiat (crypto) remains a display preference, not settlement
or fulfillment proof. Checkout freezes the exact credits, price and pricing
version; refunds and retries use that original snapshot.

In addition to the existing two-attempt daily limit, a serialized 500 NOK
per-user/environment UTC-day exposure cap counts pending and failed attempts.
No caps were reset. Cart edits, unsaved credit drafts and quote refreshes block
payment. A changed cart in another tab requires review instead of silently
charging an unseen quote. Fulfillment does not delete a later changed cart line.

Each custom amount must survive a conservative scenario using the largest reviewed
provider reservation per paid credit: FX allowance 15 NOK/USD, 6% + 2.80 NOK
payment allowance, 20% of gross reserved for potentially applicable tax,
25% extra provider-cost allowance for failures, and 15% minimum contribution
of gross. New sales stop when the model-price review expires or this guard
fails. This is a release guard,
not accounting advice or a guarantee against chargebacks/fraud/provider errors.

[PayPal's Norway fee table](https://www.paypal.com/no/business/paypal-business-fees?locale.x=en_NO)
lists 3.40% plus a fixed NOK fee for standard other commercial transactions,
with additional international fees where applicable. Verify the merchant's
actual agreement, FX fees and tax treatment; do not reuse a US Stripe estimate.

[Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
separately prices uncached input, output, cache writes and cache reads; tools and
other modes can add charges. Current text requests do not enable those tools or
cache writes. Anthropic stays disabled without a configured platform key.

## Next implementation gates

1. Verified Sandbox and Live purchase/delivery, including real webhook replay and
   refund reconciliation; local server capture alone does not prove delivery of
   a remote webhook.
2. Custom whole-credit input, server quote, additive isolated-DB migration,
   bounded daily NOK exposure and visible marginal discounts are implemented.
   Production-style local acceptance passes, including a real Chrome 555-credit
   free receipt. It exposed an older 68 NOK database check, now migrated to the
   exact maximum mixed cart of 391.70 NOK on isolated Preview only. Real PostgreSQL
   tests cover 122, 555 and maximum mixed carts and roll back every fixture/order.
   Complete deployed Preview browser acceptance, then verify the exact custom
   grant with real Sandbox capture and webhook replay/refund.
3. Buyer history is implemented locally and deployed to Preview at `/ai/credits`, linked from the chat
   balance. It reads only the signed-in user's deployment-specific account and
   latest 50 ledger entries, without source/payment identifiers or provider keys.
   Available, reserved and refund adjustment amounts are distinct; an unclaimed
   demo allowance is explained without issuing credits on a page view. Nine query
   and accounting tests pass. Strict build and local browser acceptance pass,
   including sign-in boundaries, balance navigation and 360–2560px layouts.
   Keep provider names transparent and the exact flat price visible before sending.
4. Owner-only ledger and provider-cost overview is implemented and locally
   verified (2026-09-23), and deployed to Preview, not production. It separates environments, available
   credits, outstanding reservations, refund adjustments, verified captured cash
   and conservative provider ceilings. It is not an actual invoice or profit
   statement. The daily fuse is explicitly per database, across environments.
   Fresh OWNER authorization, rate limiting and private/no-store responses apply.
   Reporting tests pass 13/13; focused browser testing covers retry, filtering,
   refresh and scrolling at 360/390/844/1280/2560 with no page overflow. The UI
   uses synthetic browser-only owner/report fixtures; independent real requests
   from the ordinary demo session remain denied (403). Strict build and touched
   implementation lint pass. The real Chrome owner session confirms Sandbox
   balance 30, 70 charged credits across three completed requests, no outstanding
   reservations, and NOK 68 across two verified captures. Page and sidebar were
   scrolled without losing report content. No account mutations were performed.
   Actual provider usage metadata remains future work; never log prompts or keys.
5. Independently verify provider-project spend caps and alerts. Do not enable
   auto-reload, raise budgets or change billing plans without owner approval.
