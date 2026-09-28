# Marketplace continuation routes — September 2026

## Scope and findings

`/products/daily-deals` and `/products/member-discount` were nearly blank
client pages with only “Under development”. They now provide responsive,
server-rendered availability information, ordinary navigation, keyboard-native
disclosures, current credit volume bands, and links to both real reviewer SKUs.
These are **not new promotion or paid-membership engines**: their planned state
is explicit, and neither viewing a page nor following a link changes a cart or
applies a discount. Credit bands reuse checkout's `CREDIT_PRICE_TIERS` and limits;
they are marginal bands, not an advertised whole-order discount.

The legacy `/dashboard/inventory` alias now returns an HTTP redirect to the
existing Trading route rather than mounting a blank client page. Authentication
still applies at the destination; the page-level server redirect is retained as
a fallback.

The [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)
informed the 1280px maximum canvas, reflow, semantic navigation, focus states,
44px targets and honest availability copy. No separate design system, animation
library, API, database schema or payment configuration was added.

## Verification

Touched lint and the first strict production build passed. **33 focused units**
cover existing credit-price safety and route-owned fallback markers, including
forged markers on protected routes. The first browser batch was **0/3** and
was not discarded:

- The visual footer was nested inside `main`, so it had no implicit contentinfo
  landmark. The shared site footer now has that explicit page-level role.
- Without JavaScript, the root streaming boundary left a generic skeleton in
  front of the server-rendered offer page. The existing public-publication
  mechanism now includes these two exact paths. The root fallback uses the same
  public copy and avoids mounting catalog fetch providers.
  Proxy overwrites a supplied marker; it never changes authorization.
- A page-level Next redirect could become a streamed HTTP 200. The legacy alias
  now uses the normal config redirect, and tests follow the anonymous redirect
  to verify that Trading still requires sign-in.

The next candidate had 3 passes, one no-JavaScript test failure and one skipped
terms test. The no-JavaScript page rendered correctly, but an unscoped summary
locator also selected inert streamed templates. The test now exercises the
accessible help region; the actual toggle assertion is unchanged. Terms was
rerun with its correct opt-in flag, not counted as a pass while skipped.

The first candidate's strict build and touched lint pass. Its local browser acceptance was
**5/5 in 12.0s plus 1/1 dark replay in 5.0s**, retries disabled: eight viewport
sizes, keyboard disclosure, real wheel scrolling/footer, actual product/terms
navigation, no-JavaScript content, private alias destination, and product
loading/terms regressions. No checkout/payment/cart writes occurred. Real Chrome
reviewed the desktop layout; mobile and desktop screenshots were reviewed.
The first Preview batch passed offer navigation, no-JavaScript rendering,
private redirect and terms checks, but failed the existing product-loading
regression (**4/5**). A subsequent read-only four-case diagnostic did not reproduce
the flash, so a warm rerun was not used to waive it. The catalog loading boundary
was still an ancestor of product-detail routes. Catalog `page.tsx` and
`loading.tsx` now live in a URL-neutral `(catalog)` route group: product detail
cannot inherit that catalog fallback. This follows the official
[route-scoped loading guidance](https://nextjs.org/docs/app/getting-started/project-structure).
The root public-offer fallback remains. URLs, shared product layout and
authorization are unchanged. The corrected candidate passes touched lint, 33
units, a fresh strict build and **5/5 local in 12.6s plus 1/1 dark in 4.8s**.
The corrected Preview passes **5/5 in 24.4s plus 1/1 dark in 7.7s**. The first,
failed Preview was not promoted. All final batches have retries disabled.

Real Chrome followed the corrected local catalog link into the product-specific
loading state, then the finished Interview Pack. Wide-screen visual review and
natural wheel scrolling confirmed a single footer at the bottom of the content:
scrollTop 649, footer bottom/viewport height both 1263px, no horizontal overflow.
The public offer routes were also inspected in real Chrome; the responsive
screenshots include light and dark 390px views and bounded desktop columns.

## Deployment record

- App source: `b690441`, including the offer slice `41e9aa5`.
- Preview: `dpl_zCo68ExKBt7uqGX2XwzPerHLX1zC` /
  `dev-veggastare-m37bj7w3l-v3ggas-projects.vercel.app`; the stable showcase
  Preview alias was inspected and points to this exact READY deployment.
- Preview uses the isolated `ep-jolly-smoke-abgwws6k` database. Local verification
  uses the guarded Sandbox launcher. No Live payment credentials were added locally.
- Production: `dpl_EiugCUHSc2R8ffFm6Gto9qMtRs2e` /
  `dev-veggastare-dqdau0akk-v3ggas-projects.vercel.app`. The skip-domain candidate
  built against `ep-orange-wildflower-abp9cs2l`, with 48 migrations and none
  pending. Its health probe returned healthy; www.veggat.com still pointed to
  the prior release before promotion. After promotion the main domain was
  inspected and resolves to this exact READY deployment.
- Live acceptance: **5/5 in 26.0s plus 1/1 dark in 6.7s**, retries disabled.
  The same eight-size/no-JavaScript/redirect/loading/terms checks ran on
  `https://www.veggat.com`; not merely the candidate URL.
- Real owner Chrome followed Daily deals → Member discounts, opened the FAQ,
  naturally scrolled to one footer (scrollTop 110, footer bottom/viewport 1263px,
  no horizontal overflow), then followed Choose AI credits to the completed
  real product page. It did not buy, alter the basket or change product settings.
  Live mobile screenshots were visually reviewed.
- Rollback: prior consent release `c3977b7` /
  `dpl_icFDX1ttc5932VRK9HZtc2Kaiuyw` /
  `dev-veggastare-20qmb7hjv-v3ggas-projects.vercel.app`.

Final generated artifacts are retained locally under
`frontend/test-results-release-offers-local-scoped{,-dark}`,
`frontend/test-results-release-offers-preview-scoped{,-dark}` and
`frontend/test-results-release-offers-live{,-dark}`. The original failed Preview
is retained separately in `frontend/test-results-release-offers-preview`.
Artifacts and private browser sessions are excluded from commits/deployment.

## Remaining mission boundaries

No real PayPal purchase/refund, AI provider call, credit grant, wallet signature
or account creation is performed by this slice. Owner-only Live payment and
inbox/provider acceptance, full remaining-route interaction, physical-device
keyboard and native 125% zoom are still separate gates.
