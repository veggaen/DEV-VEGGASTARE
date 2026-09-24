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

## Verification in progress

Touched lint and the first strict production build passed. **33 focused units**
cover existing credit-price safety and route-owned fallback markers, including
forged markers on protected routes. The first browser batch was **0/3** and
was not discarded:

- The visual footer was nested inside `main`, so it had no implicit contentinfo
  landmark. The shared site footer now has that explicit page-level role.
- Without JavaScript, the root streaming boundary left a generic skeleton in
  front of the server-rendered offer page. The existing public-publication
  mechanism now includes these two exact paths. Root and product fallbacks use
  the same public copy; the root fallback avoids mounting catalog fetch providers.
  Proxy overwrites a supplied marker; it never changes authorization.
- A page-level Next redirect could become a streamed HTTP 200. The legacy alias
  now uses the normal config redirect, and tests follow the anonymous redirect
  to verify that Trading still requires sign-in.

The next candidate had 3 passes, one no-JavaScript test failure and one skipped
terms test. The no-JavaScript page rendered correctly, but an unscoped summary
locator also selected inert streamed templates. The test now exercises the
accessible help region; the actual toggle assertion is unchanged. Terms was
rerun with its correct opt-in flag, not counted as a pass while skipped.

Final strict build and touched lint pass. Final local browser acceptance is
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
Preview/live acceptance is pending; the failed Preview was not promoted.

## Remaining mission boundaries

No real PayPal purchase/refund, AI provider call, credit grant, wallet signature
or account creation is performed by this slice. Owner-only Live payment and
inbox/provider acceptance, full remaining-route interaction, physical-device
keyboard and native 125% zoom are still separate gates.
