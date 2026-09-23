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
  regressions. Touched lint and standalone TypeScript pass; follow-up deploy
  verification is pending when this source commit was prepared.

## Outstanding work outside this release

Custom-credit paid acceptance, Live micro-purchases/refunds, owner OAuth/wallet
consent, Railway authorization, hosted CI billing and the remaining full-route QA
scoreboard are not completed by this presentation release. Basket fetch-error and
concurrent-edit handling also need a separate focused follow-up.

Rollback target before this release: `dpl_7jL8ZAP6MDY5xRdEWCHJA2Sj4A5u`
(`dev-veggastare-1jns3389f-v3ggas-projects.vercel.app`).
