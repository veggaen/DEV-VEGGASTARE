# Catalog first-render acceptance — 24 September 2026

## Change and scope

`/products` now reads the first 30 public, available listings directly on the
server and renders their cards in the initial response. The interactive client
consumes this validated snapshot without repeating the same API request after
hydration. The route is explicitly dynamic: no build-time catalog snapshot or
new shared/private cache is introduced. Existing public visibility filters,
server-authoritative checkout, auth and payment controls are unchanged.

A snapshot is accepted only for its exact query and page size. Returning from
a PDP with retained filters cannot temporarily show the unfiltered snapshot.
Search changes, pagination and retries continue through the existing abort-safe
API hook. A failed/invalid server read returns no snapshot, allowing the bounded
client request and retry UI; a successful empty result remains a real empty
catalog. StrictMode effect replay does not trigger a redundant request.

This follows Next.js's documented [server data fetching pattern](https://nextjs.org/docs/app/getting-started/fetching-data).
The UI-guidelines and webapp-testing skills informed first-image discovery,
stable geometry, filter retention, and actual scrolling verification. No new
design system or animation was added.

## Evidence

- Previous local production build: raw response **0 article cards**, product
  title absent, 90,760 uncompressed HTML bytes. The new focused Playwright
  regression failed at the missing server-rendered card as intended.
- New local build: **2 article cards**, title present, 104,621 uncompressed HTML
  bytes. The added card markup/DTO trades approximately 14 KB of raw HTML for
  removal of the initial browser product-fetch waterfall. This is not a claimed
  percentage improvement in LCP or a representative field measurement.
- **21 unit tests pass**: seeded/empty/mismatched data, StrictMode, pagination,
  filter reset, aborts, timeout, failure/retry, strict DTO validation and the
  existing public-listing boundary.
- Strict production compilation and TypeScript pass; touched-file ESLint passes.
- Real Chrome localhost: desktop view, 390×844 phone view, actual page scrolling,
  pinned toolbar, independent mobile filter drawer scrolling, and drawer close
  checked. Temporary viewport override restored.
- Focused local browser matrix: **9/9 passed in 42.1s**, covering first HTML at
  390/1280/2560, no duplicate initial request, filter/PDP persistence, selected
  currency range controls, eight-size layout/wheel tests, search races/retry,
  mobile cart-to-checkout without fulfillment, and metadata/skeleton stability.

Initial integration runs passed 8/9 checks. The old cart test first tried to
click through a dismissible success toast, then expected the obsolete `0.00 NOK`
format. It now uses the actual Close toast control and verifies the selected-
currency zero total plus Free demonstration. No force-click or payment was used.
The fixture-only availability test now starts its mocked results with a real
search interaction because browser API mocks cannot replace a server read.

## Release status

Local acceptance passed. Preview and production deployment IDs/results will be
appended after verification. This document does not claim this slice is deployed.

## Limits and rollback

This removes one catalog waterfall; it is not an all-route performance verdict.
The previously observed Speed Insights products score of 64 covered only 20
events and mixed releases. Fresh representative field data is still needed.
Native 125% zoom and physical phone keyboard behavior remain separate checks.
The skeleton still covers streamed server loading and client recovery; HTML
presence alone is not proof of a complete JavaScript-free experience.

No database migration is required. Reverting this catalog-only commit restores
the prior client-fetch implementation without changing orders, credit balances,
cart prices, or the existing 10-credit/9 NOK starter support. Do not roll back
the earlier starter-pack compatibility migration just to undo this UI slice.

**Live capture/refund remains untested.** Actual 9 NOK Sandbox capture awaits
PayPal authentication; neither demo-cart testing nor this performance work is
payment evidence.
