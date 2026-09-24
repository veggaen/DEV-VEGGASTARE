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
- The first product image's preload link is also present in the server HTML,
  rather than being inserted only after the browser catalog request completes.
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

- App source: **`e8252bd`**, image-preload assertion **`53b4dfd`**.
- Local: strict build (37.7s compilation, 17.1s TypeScript), **9/9** browser
  checks in **42.1s**, then the extra image-preload assertion **1/1**.
- Preview: **`dpl_CxomZGF76HPcYmxjygCNHrJRhJRn`**,
  `https://dev-veggastare-8ccq702ww-v3ggas-projects.vercel.app`, assigned to the
  stable isolated Preview alias. Strict build/TypeScript passed, 49 existing
  migrations with none pending, **9/9** browser checks in **1.1m**. Real Chrome
  confirms search changes to one matching product and selected fiat/crypto.
- Production: **`dpl_9vx4UsAL6W2EC9NLdD3fSSAj46DS`**,
  `https://dev-veggastare-318fx0vlj-v3ggas-projects.vercel.app`, source `53b4dfd`.
  Strict build/TypeScript passed, no pending migrations. Candidate health was
  healthy and payment capabilities remained LIVE. Promoted only after Preview
  acceptance, then `vercel inspect https://www.veggat.com` resolved this exact
  deployment. **9/9 live browser checks passed in 52.1s**.
- The first live run was 8/9: the currency test's one-time `isVisible` check
  missed the later cookie-dialog mount and tried opening filters underneath it.
  Its screenshot confirmed the cookie dialog, not a broken price conversion.
  The test now explicitly waits for/dismisses the dialog. The application did
  not change for that correction. The corrected check was also rerun locally
  and on Preview.
- Real Chrome live: 390×844 catalog layout, actual scrolling to the final card,
  pinned controls and no footer jump visually checked. Viewport reset afterward.

Artifact folders: `frontend/test-results-release-catalog-ssr-{baseline,local,
local-final,local-accepted,preload-local,preview,live,live-accepted,consent-local,
consent-preview}`. Tracked prior test artifacts were not included in commits.
The browser tests use disposable demo carts only, stop before fulfillment and
do not alter the owner's live cart or create a PayPal payment.

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
