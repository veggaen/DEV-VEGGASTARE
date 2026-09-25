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

## Local evidence

- Strict production-style build: webpack 36.5s, TypeScript 25.0s, 189 pages.
- 72 focused action, UI, company-access and same-host tests pass.
- 16 real PostgreSQL tests in an isolated Preview disposable schema pass: concurrent
  one-use verification, request rotation, stale cleanup, host/account/expiry binding,
  removal races, transaction rollback, ownership transfer and demo/deleted identities.
  The disposable schema was removed and its absence checked. No real addresses changed.
- Touched-file ESLint and diff whitespace checks pass.
- Final focused Playwright: 4/4, 12.0s, no retries/skips. Browser owner/mail responses
  are intercepted; these are UI checks, not claims of live email delivery. Real
  membership checks run separately. Widths 360/390/768/1024/1280/1920/2560 plus landscape.
- Screenshots reviewed at 390 and 1280. Payment controls fit the desktop viewport;
  both the document and app scroll container are checked for horizontal overflow.
- Initial browser harness failures are retained: session event before hydration,
  duplicate Next route-announcer alert, and testing window instead of app scrolling.
  Final evidence: `frontend/test-results-release-company-paypal-local-verified/`.
- Real Chrome: retained local session, payment status loaded, 390px viewport and
  scroll width match, form screenshot inspected, page/footer and navigation-drawer
  scrolling checked. No email, receiving wallet or payment submitted. Viewport reset.

## Deployment and remaining acceptance

Preview and production acceptance are pending for this changeset. Current live
runtime remains `cc31221` until this release is verified and promoted.

Real owner delivery/confirmation requires an intentional address request; no
unsolicited verification email was sent during QA. Company wallet selection still
needs a separate pass for eligible personal-wallet choices and genuine extension
acceptance. Whole-app S1–S9 completion is not claimed by this scoped result.
