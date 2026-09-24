# Fiat (crypto) presentation release

## Scope

Presentation-only release based on production `37866d8`. One global selector now
controls the selected fiat price and optional crypto equivalent, e.g.
`USD 3.90 (0.00195 ETH)`. Source fiat is never substituted for crypto in parentheses.
Fiat and crypto choices persist independently; No Crypto removes the parentheses.

Shared prices cover the catalogue, product detail/specification, company storefront,
mini/full cart, checkout, receipts, buyer orders, legacy order confirmation, seller
sales, warehouse orders, shipping estimates, pricing and request budgets. Seller and
company order GET responses now include the order's existing currency. Unknown
currency/rates show unavailable instead of inventing a conversion.

The selector uses radio semantics, keyboard navigation, Escape/focus return, 44px
targets, a Done action and scrollable short-screen layout. The basket gains named
44px controls, reduced-motion support, readable item rows and crypto subtotals.
Web Interface Guidelines informed these changes; real Chrome and Playwright were
used for verification.

## Money invariants

- No Prisma, checkout API, cart API, payment provider, webhook or credit-ledger changes.
- Server prices, fixed production credit pack, capture/fulfillment, rate limits and
  accepted payment methods remain unchanged. Custom credits remain Preview-only.
- These conversions are display estimates, not payment quotes. Existing PayPal
  checkout settles NOK. A separate checkout note explains this; non-demo receipts
  retain the immutable amount/currency in expandable Original payment record.
- Current rates on historical orders are not represented as historical settlement FX.
- No Live payment keys were placed in localhost; local build/tests use isolated
  Preview data and verified Sandbox credentials. No real payment was made.

## Verification

- Changed-file ESLint: passed.
- Production-source Next.js webpack build and TypeScript: passed.
- 73 conversion, mixed-currency cart and PayPal regression unit tests: passed,
  including legacy shipping amounts and missing historical currency.
- Playwright global currency journey: passed locally on :3000. Checks persistence,
  No Crypto, keyboard/focus return, short-screen menu, reduced-motion basket,
  mixed-currency totals, demo receipt and request budget fixtures. Products, cart,
  checkout, receipt, orders and pricing checked for horizontal overflow at 360,
  390, 844 landscape, 768, 1024, 1280, 1920 and 2560 widths.
- Seller and warehouse display fixture: passed locally. NOK/EUR order rows convert
  independently, and seller displayed revenue totals USD 6.10, not mixed raw units.
  Read-only fixtures do not claim API authorization or fulfillment acceptance.
- Real Chrome: 390px cart and selector visually checked; fiat changed without
  resetting ETH. Scroll and desktop basket checked. Demo cart only, no payment.
- Release `d17567c`, deployment `dpl_FB8c21bmGoLDPsjMZZAJ5sCjEJ1g`: READY and
  verified at all three production aliases. Live Playwright **3/3 (42.4s)**,
  including gate setup and both currency journeys above. Real Chrome confirms
  current-rate USD (ETH) catalogue prices in the existing signed-in session.
- A final source scan found one legacy shipping label hardcoded to dollars. It
  now uses the recorded currency through PreferredMoney, with added rendering
  regressions. Touched lint and standalone TypeScript pass. Final release
  `d74aecf` / `dpl_6qbGpvzsTJS1DpsGdWM5qfFuzRXp` is READY and read back from
  www.veggat.com with all production aliases attached. Final live browser
  **3/3 (37.3s)** passes; `/api/health` is 200/healthy. Vercel build/TypeScript
  passes with no pending migration. Real Chrome mobile checkout, scrolling,
  USD/NOK selection preserving ETH, and live basket totals were checked without
  submitting payment. Normal viewport and USD (ETH) preference were restored.

## Follow-up: selected-currency filters and resilient basket

The catalogue price range now uses the selected fiat, including labelled exact
minimum/maximum inputs, an Apply action and inline invalid-range feedback. A
currency switch preserves the same budget. Common-USD bounds are converted to
each listing currency in SQL before pagination, without replacing the public
catalogue visibility rules. Mixed-currency range/facet queries use the same basis.
Failed catalogue reads return an error, not a misleading successful empty list.

The mini-basket now reuses the bounded, row-isolated cart request lifecycle.
Failed reads show Retry; uncertain writes are reconciled by reading the saved
cart, never automatically replaying a purchase quantity change. Numeric edits
require Save/Enter, with checkout disabled until edits are saved or discarded.
Concurrent edits cannot roll back a different item's confirmed change. Account
switching clears private basket state; Escape and Close restore trigger focus.

Local acceptance before deployment:

- 90/90 focused catalogue, currency, cart and PayPal regression tests pass.
- Touched-file ESLint, production webpack build and TypeScript pass (187 routes).
- Playwright 6/6 (29.0s), including setup, selected-currency range/facets,
  mini-basket failed-read retry, lost-write-response reconciliation, full-cart
  concurrency, desktop filter docking, and the global fiat/crypto journey.
- All browser cart writes in these failure/concurrency tests are intercepted
  fixtures; they do not mutate real carts or claim payment acceptance.
- Real Chrome local: 390px NOK filter, a 30 NOK maximum excluding the 39 NOK
  product, drawer scrolling and reachable Reset; desktop basket draft/discard,
  guarded checkout and close-focus return. No saved cart mutation or payment.
- No schema, cart API, checkout, provider, webhook or AI ledger changes. Local
  remains isolated Preview data with Sandbox credentials only.

The initial live batch caught an early-click hydration race in the basket.
The trigger now stays disabled until its handlers are ready; a delayed-JavaScript
regression verifies this rather than hiding it behind a test-only wait.
Final local browser batch **6/6 (28.1s)** and live **6/6 (48.9s)** pass.
Release `bfe4fd3` / `dpl_DVNrF5kqvrnRPbRtjmzr5yd9jJbc` is READY at all three
main aliases; live health is healthy. Final local and Vercel builds/TypeScript and
touched lint pass. Real Chrome confirms the live phone NOK filter/ETH display.

Rollback before this filter/basket follow-up is production currency release
`d74aecf` / `dpl_6qbGpvzsTJS1DpsGdWM5qfFuzRXp`.

## Outstanding work outside this release

Custom-credit paid acceptance, Live micro-purchases/refunds, owner OAuth/wallet
consent, Railway authorization, hosted CI billing and the remaining full-route QA
scoreboard are not completed by this presentation release. Catalogue filter URL
persistence, full-cart/mini-basket cross-surface draft handoff and the broader cart
provider lifecycle remain follow-ups. This is not a claim that every financial
input, tax record or experimental trading UI was audited.

Rollback target before this release: `dpl_7jL8ZAP6MDY5xRdEWCHJA2Sj4A5u`
(`dev-veggastare-1jns3389f-v3ggas-projects.vercel.app`).
