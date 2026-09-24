# Checkout and flexible credit budgets

## Change

- Checkout uses a bounded 1280px canvas and balanced desktop columns. Order
  items and explicit delivery requests occupy the main column; the payment
  summary stays compact. Small screens stack the same content in reading order.
- Secondary sales terms and purchase-limit explanations use keyboard-accessible
  disclosures. Actual settlement, order totals, consent and errors stay visible.
  Consent wording, stored version and unchecked defaults are unchanged.
- The product, basket, cart and checkout share credit and spending-budget inputs.
  Custom range: 100–10,000 whole credits, plus the existing 10-credit/9 NOK starter.
  A 1,000 NOK budget selects 2,815 credits for 999.77 NOK; 10,000 costs 3521.70 NOK.
  Remaining budget is not charged. Selected non-NOK budgets use fresh reference
  FX only; missing/stale FX disables that input but not direct credit entry.
- The server still prices only the selected credit count. Neither a client price
  nor a spending budget can set the capture amount. Quotes remain NOK; displayed
  fiat/crypto values are estimates. Existing saved orders are never repriced.
- Marginal discounts remain 0%/5%/10%. Maximum order is 3550.70 NOK including the
  separate file SKU. Daily exposure is now 5,000 NOK with the existing two-attempt
  cap, both serialized by account. This is a deliberate expansion for the larger
  purchase range, not removal of a safeguard. Provider usage fuses are unchanged.
- The fail-closed model-cost margin guard covers every allowed amount under the
  current planning allowances. It is not an actual-profit, FX, tax or chargeback
  guarantee. No subscription, automatic top-up or automatic debt collection.
- Quantity-neutral artwork is generated from the existing SVG source. A new
  `credits-cover-v2.jpg` URL avoids stale optimized-image caches. The seed refresh
  changes only the known credit listing's copy, specifications and image.

## Local evidence (24 September 2026)

- Strict production-style build and touched-file lint pass against isolated
  Preview DB with authenticated Sandbox credentials, never Live PayPal keys.
- Pricing/cart/quote/prepare/budget units: 119 passing; request-detail units: 18.
- Payment/ledger regression group: 41 passed, 21 skipped (not claimed verified).
- Real PostgreSQL prepare checks cover 122, 555, 2815 and a mixed 10,000-credit/file
  order in both demo and Sandbox modes. Synthetic rows roll back; no provider call.
- Browser checks: flexible budgets, 9 NOK starter and explicit delivery consent
  pass. Budget flow covers eight sizes (360 to 2560, including landscape) in light
  and dark mode, persistent cart edits, currency switching, dirty-state payment
  lock and over-range rejection. Payment posts are intercepted, not captured.
- An initial budget browser failure typed into the departing cart during route
  navigation. Waiting for the checkout heading fixed the test; the lock assertion
  remains. Inputs are also disabled until their client handlers are mounted.
- Real Chrome on localhost: entering 1,000 NOK selects 2815; applying displays
  999.77 NOK and updates the product preview. No basket/order/payment was created.

Artifacts: `frontend/test-results-release-credit-budget-local-transition/`,
`frontend/test-results-release-credit-budget-local-hydrated/` (includes the earlier
failure plus passing starter/request checks), and
`frontend/test-results-release-checkout-compact-local-final/`.

## Remaining acceptance

Hosted deployment and browser verification of this slice are pending. Fresh
Sandbox starter capture and Live micro-purchase remain unverified. The owner
must authenticate PayPal and approve any required real payment. Seller/admin
payment reports and refunds retain their existing status; this UX pass is not
whole-product industrial-grade acceptance.

## Design references

The layout keeps review information visible and moves only secondary help into
disclosures, informed by [Baymard's order-summary research](https://baymard.com/research-articles/accordion-checkout-usability).
The existing PayPal no-shipping, PAY_NOW and return-to-receipt flow remains aligned
with [PayPal's one-time checkout guidance](https://developer.paypal.com/platforms/checkout/standard/best-practices/one-time).
The design audit and composition skills guided semantic controls, shared input
behavior, focus/error handling and server-rendered content slots.
