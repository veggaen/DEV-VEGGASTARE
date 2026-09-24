# Product reads and payment availability — September 2026

## Scope and release

App commit: `6654f24` on `release/showcase-september`; main is unchanged.
Local, Preview and production acceptance are complete for this scoped slice.
Preview: `dpl_BY735VMbG2tbojeQjbYLugmTYTmt`,
`dev-veggastare-5etq712b8-v3ggas-projects.vercel.app`, assigned to the existing
`dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app` alias.
Production: `dpl_HmPFfAVgHNXUxj6s2TSf6rARTHhy`,
`dev-veggastare-jbnv6j873-v3ggas-projects.vercel.app`, promoted to
`https://www.veggat.com` after candidate health and Live capability checks.
The live domain was inspected and resolves to that exact deployment ID.
Rollback before this slice: app `b690441`, deployment
`dpl_EiugCUHSc2R8ffFm6Gto9qMtRs2e`.

## Changes

- Product read helpers are internal `server-only` modules, not Server Actions.
  The previous local build registered both `fetchProductById` and
  `fetchProductsWithDetails`; the new built server-reference manifest contains
  neither. A forged action HTTP exploit was not attempted, so this is evidence
  of removed unnecessary exposure, not proof of prior exploitation.
- Detail queries select only the authorization/DTO fields, not entire product
  rows, private asset identifiers or wallet relations. API visibility checks
  remain in force. Every detail response is `private, no-store`.
- A database outage returns a sanitized, retryable 503 rather than a false 404.
  Missing products and inaccessible private products still return 404.
- Catalog filter state stays in its existing provider across detail navigation.
  Its four metadata requests run only on `/products`, not product detail or
  offer pages. No new design system, SSR migration or shared private-data cache.
- `/api/payments` reports the paused legacy checkout separately from the two
  reviewer SKUs' actual PayPal capability and environment. It does not label
  unimplemented crypto as available. The admin page explains that its disabled
  legacy switch is **not** a global stop switch for reviewer PayPal checkout.
  No new payments, refunds, runtime switches, keys or database schemas changed.

## Verification

- Touched-file ESLint, `git diff --check`, strict Next production build and
  TypeScript passed.
- **27/27 unit tests**: public catalog, private-detail access, minimal selection,
  invalid IDs, absent rows, database failures, legacy JSON normalization,
  stale-authorization boundary, Sandbox/Live/missing-key capabilities and paused
  legacy session creation. Provider/fulfillment calls are not made by these tests.
- Final local browser selection: **7/7 in 15.8s**. Product reads/search retention
  at 390 and 1280; request counts; real capability API; guest/demo admin rejection;
  product retry and shell continuity at both widths; direct/client-nav skeleton
  geometry; offer navigation and scrolling at eight widths from 360 to 2560.
- Preview: the identical selection passes **7/7 in 45.8s**, with real Sandbox
  capability reporting and the isolated Preview database. No new payment or
  fulfillment was performed by this slice's browser runs.
- Production: identical selection **7/7 in 41.7s** on `www.veggat.com`, with
  real Live capability reporting. Candidate health reported healthy; both
  deployments completed strict builds with 48 migrations and none pending.
- Local real Chrome: interview product → catalog search `Interviewer` → credits
  detail → back retains search and result. Actual wheel scrolling reaches one
  footer: inner scrollTop 649, scrollHeight 1787/clientHeight 1138; footer bottom
  equals viewport height 1263. Width 2498, no horizontal page overflow.
- Real Chrome's viewport override worked this turn and was measured at 390×844.
  The local loaded gallery, image-2 navigation, buy box and pinned purchase bar
  were visually checked. At scroll bottom (1998 of 2717−719), footer bottom
  763.58 sits above the purchase bar, with all footer links visible and no
  horizontal overflow. The normal 2498×1263 viewport was restored afterward.
- Live owner admin page, real Chrome: reviewer status is `LIVE · PayPal`, the
  legacy switch is disabled, and the scope warning is visible. Checked settled
  screenshots at 390×844 and 1280×800; neither has horizontal page overflow.
  Desktop scrollTop 360 reaches footer bottom 800, equal to viewport height.
  No switches were clicked. The default viewport was restored.
- Inspected 390/1280 catalog screenshots: retained search, correctly bounded
  cards and selected fiat (crypto) display. These are viewport tests, not proof
  of physical phone, browser 125% zoom, or field Core Web Vitals.

### Failed attempts retained

- The new request test on the old build failed as intended: four catalog-only
  requests instead of zero on a direct product visit. Candidate passes with zero.
- First unit harness used nested `it.each` arrays incorrectly for an empty ID;
  changed to named rows, keeping the validation assertion intact. Final 27 pass.
- An attempted owner UI fixture using the demo session hit the intentional
  unfinished-admin gate. It is not owner-UI acceptance and was not bypassed.
  Replaced that invalid assumption with a real guest/demo authorization test;
  subsequently verified owner presentation using the real permitted Live
  browser session, not elevated demo credentials.

Artifacts: `frontend/test-results-release-product-read-baseline/`,
`frontend/test-results-release-product-read-local-final/` (failed admin fixture),
`frontend/test-results-release-product-read-local-accepted/` (final local).
Cloud runs: `frontend/test-results-release-product-read-preview/` and
`frontend/test-results-release-product-read-live/`.
Artifacts and sessions remain uncommitted and excluded from deployment.

## Boundaries and next checks

This is not whole-app approval. Verified Web3 checkout and general-marketplace
payment remain unreleased. Owner Live micro-purchase/refund, legal review,
human inbox confirmation, remaining OAuth and backend/wallet checks still need
their own evidence. Owner presentation was checked Live, not via local demo.
No end-to-end speed percentage or millisecond improvement is claimed from the
four-request reduction. A catalog screenshot also exposed the minor label
`1 products`; the admin system-default timestamp displays January 1970. Record
both for the next focused presentation pass rather than calling every page
polished. General listings' purchase-button behavior also needs review against
the explicitly restricted checkout capability.

Webapp-testing guided scoped browser assertions; composition-pattern guidance
kept request policy in the existing state provider; Web Interface Guidelines
guided reflow/focus checks and the explicit payment-state wording.
