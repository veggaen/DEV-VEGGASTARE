# Company PayPal settings — 25 September 2026

## Scope and safety

The permanent `cveggatshowcasestudio00001` ID is 26 characters; the previous
25-character action validation rejected it. The bounded company-ID validation
now accepts it without bypassing current ownership checks. Existing IDs and
purchase records are unchanged.

Receiving email requests now preserve the existing address until the replacement
is confirmed. Requester/site/current-address-bound token hashes replace stored
bearer secrets. Review is read-only; an explicit button confirms the address.
The current user and company are locked in a consistent order. Token consumption,
fresh ownership validation and the address update commit atomically. Stale removal
forms and former-owner links fail; mail-failure cleanup matches only its own token.
Old pre-release verification links must be requested again. No schema migration.
This proves inbox access, not PayPal merchant onboarding or automatic seller payouts.

The settings page removes the oversized marketing banner and metadata-card wall.
Payment controls come first, side by side on desktop and stacked on smaller screens.
Optional details, team management and deletion use disclosures. Tokens, focus states,
44px controls, safe website links and corrected warehouse navigation are retained.
Background company refresh no longer replaces the loaded page with a loading screen.
The company route keys its client by company ID so unsaved metadata cannot carry
over when navigating to another company.

## Local evidence

- Final strict production-style build: webpack 34.0s, TypeScript 11.0s, 189 pages.
- 74 focused action, UI, company-access, same-host and currency-route tests pass.
- 16 real PostgreSQL tests in an isolated Preview disposable schema pass: concurrent
  one-use verification, request rotation, stale cleanup, host/account/expiry binding,
  removal races, transaction rollback, ownership transfer and demo/deleted identities.
  The disposable schema was removed and its absence checked. No real addresses changed.
- Touched-file ESLint and diff whitespace checks pass.
- Final focused Playwright: 4/4, 11.8s, no retries/skips. Browser owner/mail responses
  are intercepted; these are UI checks, not claims of live email delivery. Real
  membership checks run separately. Widths 360/390/768/1024/1280/1920/2560 plus landscape.
- Screenshots reviewed at 390 and 1280. Payment controls fit the desktop viewport;
  both the document and app scroll container are checked for horizontal overflow.
- Initial browser harness failures are retained: session event before hydration,
  duplicate Next route-announcer alert, and testing window instead of app scrolling.
  Runtime source `2b1c540` evidence: `frontend/test-results-release-company-paypal-local-acceptance/`.
- Real Chrome: retained local session, payment status loaded, 390px viewport and
  scroll width match, form screenshot inspected, page/footer and navigation-drawer
  scrolling checked. No email, receiving wallet or payment submitted. Viewport reset.

## Deployment and remaining acceptance

The first Preview (`dpl_G5D2ubTEUVYBnHzouBrbEF1rBVUU`) terminated with an error:
prerendering `/api/currency-rates` exceeded 60 seconds on each of three attempts.
It was not promoted. `2b1c540` adds Next's request-time `connection()` boundary
outside the route's catch block; external rate fetching no longer runs during
deployment prerendering. Existing provider TTLs and stale-rate reporting remain.
Two regression tests verify ordering and that the boundary is not swallowed.
See [Next.js connection](https://nextjs.org/docs/app/api-reference/functions/connection).

Corrected Preview `dpl_EZfKKjXPJzau8Z3JuXwwJPsx36L6` is READY (webpack 42s,
TypeScript 22.1s, 189 pages) with 53 migrations and none pending on the isolated
Preview database. Health and live currency-response checks passed before updating
the existing Sandbox alias. Final focused Preview browser tests pass 4/4, 17.0s, with no
retries/skips; screenshots at 390 and 1280 were inspected. Evidence:
`frontend/test-results-release-company-paypal-preview-acceptance/`.

Production `dpl_D3pZ51WDfYmCamiWW2e8QNKjPic3` is READY and promoted to
`www.veggat.com`, with runtime source `2b1c540`. Strict build passed (webpack 43s,
TypeScript 21.8s, 189 pages); 53 migrations, none pending. Candidate health,
currency freshness and anonymous private-company 401/no-store checks passed before
promotion. Live health and currency freshness pass; the observed warm DB latency
was 31ms, not a performance percentile.

The first live UI run passed three checks but its owner fixture left a session
`route.fetch()` in flight during context teardown. The test now resolves the
retained demo session once, fulfills browser-only identity refreshes locally, and
waits for route handlers before closing. Application code is unchanged by this
test-only correction. Final local/Preview/Live runs pass 4/4 each, respectively
11.8s/17.0s/14.6s, with zero retries/skips. The initial failure is retained; final
live evidence: `frontend/test-results-release-company-paypal-live-acceptance/`.

Real Chrome with the retained live owner session now loads Veggat Studio's payment
settings without the former invalid-ID error. The 390px viewport has 390px document
width, 44px email input and no app-container horizontal overflow. The actual page
scroller reaches the footer; the drawer scrolls to lower wallet controls, closes,
and the viewport is reset. No console errors observed. Existing owner wallet links
remain present; no company email, wallet or payment mutation was submitted.

Real owner delivery/confirmation requires an intentional address request; no
unsolicited verification email was sent during QA. Eligible company/personal
wallet choices and stale selection protection are now deployed and verified in
[the company wallet follow-up](company-wallet-evidence-2026-09.md). Genuine
extension acceptance remains separate. Whole-app S1–S9 completion is not claimed
by this scoped result.
