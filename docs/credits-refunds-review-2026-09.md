# Credits, digital delivery, and refund review — 24 September 2026

## Assessment of the supplied Google AI advice

The reservation architecture is useful, but the claims of complete protection,
guaranteed profit, and automatic PCI compliance are not justified. This is a risk
review, not a legal opinion or an assurance that every route has passed QA.

- Reserve atomically before calling a provider; never trust a browser balance or
  price. A variable containing `locked_credits` alone is not a durable reservation.
- Token counting is model/API-specific. An OpenAI tokenizer is not established as
  an exact Grok tokenizer. xAI documents extra inference framing tokens; Claude's
  count endpoint explicitly returns an estimate. A universal +20/+500 allowance
  is not a proof of an upper bound.
- Output caps include non-visible tokens where the provider specifies this.
  They are ceilings, not a promise of that many visible words or tokens.
- Built-in tools are not universally free. Tool calls, search input, containers,
  storage, repeated model turns and cached-input categories need separate budgets.
- Refunding a customer's failed generation does not establish that the provider
  charged nothing. Timeouts, interrupted streams, and retries consume risk budget.
- Payment fees, applicable tax, FX, hosting, fraud and chargebacks affect margins.
  A 2–3x markup is not a guaranteed net profit percentage.
- Keep manual top-ups and no subscription. The suggested auto-top-up would change
  the current product promise and is not being added. Do not invent “Most Popular”
  sales claims or approximate blog-post counts without measured evidence.

## What the reviewed Veggat implementation actually does

`lib/ai-chat/credit-policy.ts`, `generation.ts`, `provider-stream.ts`,
`lib/ai-credit-ledger.ts`, and `lib/ai-credit-purchase.ts` were inspected.

The current offer is **fixed credits per bounded text message**, disclosed before
send, not metered token resale. It uses a model allowlist, 10,000 UTF-8 input-byte
cap including system/history, 2,048 output-token cap, no tools/images in this
funded path, and a 40-second provider timeout. Reviewed cost ceilings expire.
Database reservations serialize balance checks and apply an independent daily
platform fuse and request/concurrency caps. Failed requests return user credits
without returning platform risk budget. Custom purchase discounts are marginal,
server-priced, and tested against conservative cost/fee/tax allowances.

Focused provider/pricing checks initially passed 59 with 21 database tests skipped.
The follow-up explicitly selected the isolated Neon Preview database: **31/31**
ledger/configuration/checkout tests passed, including all 21 previously skipped
ledger cases and one real custom-checkout test. They create only a validated
temporary schema or roll back synthetic writes; no public balances or provider
APIs are used. Production/default URL fallback was removed from the test setup.
Exact actual-token
settlement, provider-invoice reconciliation, and zero business losses are not
claims supported by this implementation.

## Download/refund distinction and remaining work

A successful download cannot be taken back from a customer's device. Revocation
only prevents future access. A seller-issued/provider-ordered refund must still
reconcile, even after a download; ignoring it would leave unpaid entitlements.

Norwegian withdrawal rules distinguish digital content from digital services.
Starting a download alone is not adequate evidence of a valid withdrawal waiver.
Prior express consent, acknowledgement and durable confirmation matter. Defect
claims and applicable PayPal/card disputes are separate. Have Norwegian counsel
review final terms and seller details before treating these controls as compliance.

Findings and current disposition:

- FIXED locally and in Preview: `frontend/app/terms/page.tsx` separates digital content/services,
  preserves defect/dispute rights and replaces the discontinued EU ODR link.
- FIXED locally and in Preview: `frontend/app/api/returns/[id]/route.ts` rejects manual REFUND;
  all order lines must belong to the seller or their managed companies. Approval
  is only a review decision, not money returned. Same-origin, durable throttling,
  concurrency and sensitive-error guards were added. 13 regressions pass.
- Checkout has no persisted separate digital-delivery consent/acknowledgement.
  Do not retroactively manufacture consent for existing purchases.
- Download counters are useful delivery evidence, not proof of client receipt or
  blanket grounds to reject defect claims. Preserve buyer support/reporting.
- Product detail visual/scroll/keyboard audit completed for this slice at 360,
  390, landscape, tablet, desktop, portrait and ultrawide. Three journeys pass
  locally and on Preview; see `product-refund-ui-qa-2026-09.md`. This does not
  mean every route, live checkout or real-device keyboard has passed.

## Primary sources checked

- [OpenAI token accounting](https://developers.openai.com/api/docs/guides/token-counting)
- [OpenAI tool pricing](https://developers.openai.com/api/docs/pricing)
- [xAI billing and token-count differences](https://docs.x.ai/developers/faq/billing)
- [Claude token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)
- [Norwegian consumer guidance for digital content](https://www.forbrukerradet.no/forside/digitalt/strommetjenester-og-digitalt-innhold/)
- [Norwegian consumer guidance for software defects](https://www.forbrukerradet.no/forside/digitalt/apper-og-programvare/)
- [Norwegian legislative explanation of withdrawal requirements](https://www.regjeringen.no/no/dokumenter/prop.-50-ls-20222023/id2966742/?ch=8)
- [PayPal Norway buyer protection](https://www.paypal.com/no/legalhub/paypal/buyer-protection?locale.x=en_NO)
- [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)
- [EU ODR platform closure](https://consumer-redress.ec.europa.eu/site-relocation_en)
