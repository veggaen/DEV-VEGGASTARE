# Display rates and historical amounts — September 2026

## Scope and authority

Application source: `bbadc04` on `release/showcase-september`; main is unchanged.
This is a display/reliability correction, not a payment-currency or settlement
change. No credentials, migrations, capture/refund rules or credit ledger rules
changed. Previous production/rollback: `08d9937`,
`dpl_3maNEBbPW77m28QLgu127w64hT9P`
(`dev-veggastare-h7vklvh3x-v3ggas-projects.vercel.app`).

## Bugs reproduced and corrected

- On the preceding release, a cold rate-service outage displayed invented
  USD/ETH conversions from hard-coded defaults. It now displays unavailable
  conversion state, retaining valid same-currency amounts where possible.
- A response marked stale became apparently fresh after a browser reload.
  Versioned cache records now retain server fetch timestamps and freshness flags.
  Unversioned caches and quotes without usable timestamps are discarded.
- Fiat and crypto freshness use one-hour and five-minute windows respectively.
  Last available quotes are explicitly stale and expire after seven days. This
  is presentation fallback only, never authority for a PayPal amount or credit.
- API adapters validate positive finite quotes; missing crypto symbols are not
  replaced with made-up prices in an otherwise fresh provider response.
- A fresh cache avoids the mount request. Requests coalesce, time out after
  12 seconds, and refresh while visible; browser storage denial does not discard
  a successfully fetched quote. The global selector provides status and retry.
- On landscape phones, the compact retry/Done row leaves more of the scrolling
  currency list visible. Both actions retain 44px minimum targets.
- Receipts, buyer orders and seller orders visibly distinguish immutable
  recorded amounts from display equivalents at current reference rates. The
  normal selected-fiat (selected-crypto) format is preserved. Actual recorded
  currency remains in clearly labeled transaction details, not parentheses.
- Product budget filters provide a retry after rate failure instead of a
  permanent loading label.

## Local acceptance

Two browser regressions failed before these corrections: cold outage fabricated
a conversion, and reload lost stale provenance. The final assertions pass.

- Strict production build and TypeScript pass; 188 generated routes.
- Touched-file ESLint and `git diff --check` pass.
- **89/89 units**, eight focused files, cover quote validation/cache, display,
  receipt states, order presentation, filters, catalog and seller read models.
- **7/7 scoped browser tests pass, 25.5 seconds**, retries disabled: outage and
  retry, stale reload, fresh cache and denied storage, historical orders/receipt,
  seller dashboard states, price filters, global currency persistence.
- The global currency test visits products, cart, checkout, a retained receipt,
  orders and pricing at 360, 390, 844 landscape, 768, 1024, 1280, 1920 and 2560
  widths, asserting no page/main overflow. It checks keyboard menu operation,
  short-screen Done reachability, basket pricing and mixed-currency display.
- Rate responses are controlled browser fixtures with the actual timestamped
  response shape. Auth, retained orders and receipt reads are real. The seller
  dashboard and mixed-currency/job-budget cases use browser-only fixtures.
- For an empty retained demo cart, the test first verifies `isDemo`/`USER`, adds
  one reviewer-credit line and removes only that exact line in `finally`, then
  verifies the cart is empty again. It does not complete checkout, grant credits,
  change an owner's cart or alter stored prices. A prior free demo checkout had
  emptied the old fixture; this corrects setup, not a weakened assertion.
- Real Chrome verifies the local receipt at 390px, actual scrolling to support
  and the footer, and 844x390 menu scrolling to the final crypto choices. Visual
  inspection prompted the smaller menu footer. Temporary viewport reset.

## Deployment acceptance

- Preview: `dpl_6MPLUXGuAkZEop6u53HhciBtpmvW` /
  `dev-veggastare-6dmu6p412-v3ggas-projects.vercel.app`. Stable
  `showcase-ai-revival` alias inspected against this exact READY deployment.
  Strict build/TypeScript pass against the isolated Preview database; 48
  migrations, none pending. **7/7 deployed browser tests pass, 51.8 seconds**,
  with retries disabled. Real Chrome additionally shows real USD (ETH)
  reference quotes and the deployed currency-menu controls.
- Production: `dpl_Gh1cjhYcXTydb3T3qnsxoZ3TureT` /
  `dev-veggastare-e19uognhv-v3ggas-projects.vercel.app`. Strict build/TypeScript
  pass against production; 48 migrations, none pending. Before promotion,
  candidate health was healthy, capabilities reported reviewer-only Live PayPal,
  and www.veggat.com still resolved to the preceding `08d9937` deployment.
- After promotion, www.veggat.com was inspected against the exact new READY ID.
  **7/7 live browser tests pass, 54.9 seconds**, with retries disabled. Retained
  demo-only cart setup/cleanup ran as described above; no real purchase occurred.
- Real Chrome verifies live USD (ETH) prices and the new menu on the existing
  owner session, without changing the owner's cart, product or payment. Captured
  error logs are empty. Its viewport capability affected the selected Resend
  handoff tab, not the controlled product tab: inspection measured 2498px on
  the latter, so this is **desktop**, not additional live mobile evidence. The
  override was reset. Local real-Chrome phone/landscape checks and deployed
  Playwright mobile checks remain the applicable narrow-screen evidence.
- Existing PayPal, owner-payment and email-provider handoff tabs are preserved.
  Artifacts remain local/excluded: `frontend/test-results-release-rates-` folders
  for local/Preview/live, and `test-results-release-rate-baseline*`.

## Boundaries

These are reference estimates, not bank-statement FX or guaranteed payment
quotes. Existing legacy server fallback helpers still support other older
modules; this change does not certify those calculations or enable Web3 payment.
No paid order, refund, file grant or AI request was made for this slice.

Owner Live purchase/refund, legal review and human-inbox receipt delivery remain
separate acceptance items. So do remaining OAuth/wallet/backend checks, general
marketplace/verified Web3 checkout, exhaustive route interactions, native 125%
zoom and a physical phone keyboard. No whole-app accessibility or field-speed
certification is implied.

Webapp-testing informed deterministic regressions and safe fixture cleanup;
Web Interface Guidelines and computer-use informed usable retry states, target
sizes and actual short-screen scrolling.
