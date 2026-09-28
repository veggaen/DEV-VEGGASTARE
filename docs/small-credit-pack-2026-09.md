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

Application source: `a095d0e`; extended browser test: `226744f`.
Preview: `dpl_C16oxUiRDmUx1iwGpsiLLmM9PfxT` (`9s45jmh8m`) at the isolated
showcase alias. Production: `dpl_9LVVv2jJJMeYcQrEVCT55Etm4rdD` (`gyp6h7d7a`)
on www.veggat.com, inspected after promotion. Strict builds pass. The additive
49th migration is applied to both databases; no existing balance/order changed.

Local strict build/TypeScript and touched ESLint pass. Focused units: 115/115
pass, including server pricing, exact grant and replay denial. Ten checks of
the actual isolated database constraint pass in a rolled-back temporary table.
The local browser journey passes: PDP selection, explicit update, saved cart,
invalid quantities, normal-price restoration, 9 NOK checkout quote, reload and
overflow checks at 360/390/1280/2560. Its demo checkout POST is intercepted:
no order, payment or purchased credit is created. Real Chrome separately verifies
the 10-credit gallery, access count and 9 NOK price update without purchasing.
An additional 44 refund/receipt/confirmation units pass (**159 total scoped units**).
The extended browser journey (including header-basket edits) passes on local
(9.2s), Preview (22.7s) and live (28.2s), with retries disabled. It preserves the
known ordinary-pack fixture in an app-issued disposable demo cart and restores
it after testing. No owner's cart is used by Playwright. Checkout POSTs are mocked.

The first extended run looked for a desktop-only basket button at phone width;
the test now exercises that control at 1280. The first Preview run correctly
refused an occupied fixture cart; it now recognizes/restores only the known
100-credit demo fixture and still refuses unexpected contents. These setup
failures are not counted as app defects or passing runs. Screenshots of the
390 checkout and 1280 basket were visually inspected.

Real Chrome verifies the starter selection on local and Preview. At the owner's
request to lower the next Live test, the retained real Live checkout was refreshed
and explicitly changed from 100 to 10 credits using the normal UI. The saved line
and total agree (9 NOK, displayed in the selected USD/ETH preference). The delivery
checkbox remains unchecked; Continue to PayPal was not clicked. No Live order,
capture, credit grant or refund was initiated by this change.
The preceding local build fails the new starter-button regression as expected.
Migration expands the cart check only; no data rows or balances are modified.

Actual 9 NOK Sandbox capture and Live approval are separate acceptance evidence,
not implied by mocked provider tests or a working cart/checkout page. Do not
ask the owner to repeat a 39 NOK purchase. Do not automatically tick delivery
waivers or make a Live payment.

## Rollback boundary

The preceding app is `9c437cd` / `dpl_ASxDaUbduMNpF9P2YLTdXwLpPxcg`.
Do not blindly promote it after starter cart rows exist: its reader rejects
10-credit carts. Prefer a forward fix that retains recognition of stored small
packs and immutable purchased quotes. Do not delete user carts or rewrite paid
receipts to force a rollback. The additive database constraint can remain.

The testing and computer-use skills informed explicit, observable selection,
saved-cart checks and separate handling of payment approval. No computer action
accepted legal consent or submitted a Live payment.
