# Lower-cost Live checkout acceptance

The owner clarified that no Live purchase has been completed. Earlier pasted
handoff text must not be treated as payment evidence. Live capture/refund remains
untested until a verified transaction exists.

## Offer and safeguards

- New explicit starter selection: **10 credits for 9 NOK total**. It uses the
  existing credit product, server quote, verified capture and ledger paths.
- Normal pricing is unchanged: 100 credits remains 39 NOK; 122 remains 47.16
  NOK; volume discounts still apply only to the existing larger quantities.
- The starter pack is higher per credit, not a discount on 100 credits. No
  recurring payment, automatic top-up, client-supplied price or test bypass.
- It grants exactly 10 credits only after verified payment. Existing order
  quotes/receipts are immutable and are not repriced. Demo remains free and
  does not mint purchased credits. Spending reservations and caps are unchanged.
- Only exactly 10, or whole amounts 100–1,000, are allowed. Cart API, response
  validation, checkout and the database constraint agree. 11–99 are not
  silently rounded or treated as starter packs.
- Selection is explicit: choose the starter button (or type 10), then Update
  credits. Dirty edits block checkout. Shared UI displays the selected fiat
  (crypto) equivalent; PayPal's actual settlement total remains 9 NOK.

## Economics

Under the existing conservative model-cost and fee allowances, the 9 NOK sale
reserves 1.88 NOK for provider usage/failures, 3.34 NOK for payment fees and
1.80 NOK for potential tax. Contribution is 1.98 NOK versus the required
1.35 NOK floor. This is a planning guard, not a guarantee of net profit or a tax
determination. Costs above the guard pause sales; no safeguard was relaxed.

The current [PayPal Norway merchant fee table](https://www.paypal.com/no/business/paypal-business-fees)
lists a 2.80 NOK fixed fee plus the applicable percentage, so a 1 NOK public
credit sale would not be a sound ordinary product price. Sandbox remains the
place for repeated no-real-money tests. Review actual merchant fees separately.

## Verification

Local strict build/TypeScript and touched ESLint pass. Focused units: 115/115
pass, including server pricing, exact grant and replay denial. Ten checks of
the actual isolated database constraint pass in a rolled-back temporary table.
The local browser journey passes: PDP selection, explicit update, saved cart,
invalid quantities, normal-price restoration, 9 NOK checkout quote, reload and
overflow checks at 360/390/1280/2560. Its demo checkout POST is intercepted:
no order, payment or purchased credit is created. Real Chrome separately verifies
the 10-credit gallery, access count and 9 NOK price update without purchasing.
Preview/live checks remain pending.
The preceding local build fails the new starter-button regression as expected.
Migration expands the cart check only; no data rows or balances are modified.

Actual 9 NOK Sandbox capture and Live approval are separate acceptance evidence,
not implied by mocked provider tests or a working cart/checkout page. Do not
ask the owner to repeat a 39 NOK purchase. Do not automatically tick delivery
waivers or make a Live payment.
