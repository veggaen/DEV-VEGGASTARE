# Preview sign-out — September 2026

## Change

Ordinary Auth.js Sign Out now revokes an active account-preview grant, with an
atomic `signout` audit. It does not restore owner access, increment either user's
credential version, delete OAuth links or invalidate a different preview grant.
Already-ended, malformed legacy or missing grants need no new audit.

Auth.js catches sign-out event errors and would normally still clear the cookie.
The Node route now tracks preview-revocation failure per request and returns a
retryable, private/no-store 503 instead of that misleading success response.
It preserves the current cookie on failure. CSRF and callback validation stay
inside the existing Auth.js handler; the wrapper never authorizes a sign-out.
Raw database errors are not passed into Auth.js logs or responses.

The preview banner and shared wallet/logout flow check the server response
before navigating. Failed sign-out leaves retry controls visible instead of
forcing a redirect. CSRF retrieval and sign-out have bounded timeouts; optional
cross-tab session refresh can delay confirmed navigation by at most one second.

## Verification so far

- 181 focused tests pass across preview sign-out, checked client sign-out,
  Auth.js session validation, preview issuance, admin detail, installed-library
  regressions and proxy safeguards.
- Tests call the installed Auth.js CSRF/cookie handler: invalid CSRF cannot revoke,
  valid sign-out clears the cookie, and a failed audit returns 503 without a
  clearing cookie. Concurrent request contexts cannot share failure state.
- Nine real PostgreSQL tests pass in a disposable schema. Added checks cover
  idempotent sign-out, rollback/retry, unchanged principals and a race between
  End Preview and Sign Out with exactly one closing audit. Disposable schema
  removed after the run. Touched ESLint passes.
- Strict local production build and full TypeScript pass.
- Actual localhost HTTP/UI acceptance passes with two disposable isolated
  principals: CSRF sign-out, real recovery-button sign-out, copied-cookie denial,
  rejected owner-restoration replay and exact start/end/signout audits. Only the
  failed Return response is simulated to expose the recovery button; its Sign
  Out uses real CSRF, transactions and cookie clearing. Both QA users and their
  test audits/grants are removed. No customer/provider/payment/email is affected.
- Local light 4/4 and dark 4/4 pass with zero skips/retries. The new browser case
  retains the alert/button after 503, then permits keyboard retry and navigation;
  screenshots at 390/1280 show no horizontal overflow or covered controls.
  Existing preview/settings checks still span all eight requested widths.
- One extended local run hit the existing one-minute gate throttle while
  unnecessarily re-submitting a valid gate login. The runner now reuses its
  app-issued gate cookie; the later full rerun passes. No cap was reset/loosened.
- No production customer was previewed, changed or signed out.

## Deployed acceptance

Runtime `6f8de52`:

- Preview `dpl_GnoYHHqcKnueqKji9HGLovowndVF`, immutable
  `https://dev-veggastare-qpsgoncl3-v3ggas-projects.vercel.app`, is assigned to
  the existing isolated Sandbox alias. Strict remote build and health pass;
  light **4/4** and dark **4/4** pass with zero skips/retries.
- Production `dpl_9apZWJjqFi3qeZ8PsDVHCSH1JDLv`, immutable
  `https://dev-veggastare-2g80u03cp-v3ggas-projects.vercel.app`, passed strict
  remote build and health before promotion. CLI inspection confirms that
  `www.veggat.com` resolves to this deployment. Live light **4/4** and dark
  **4/4** pass with zero skips/retries. No database migration was required.
- Hosted checks include actual anonymous/demo denial and browser-only failed
  sign-out/retry fixtures. The positive durable-revocation and copied-cookie
  checks use real localhost HTTP/Auth.js with disposable isolated principals;
  they do not mutate a production customer or claim hosted customer logout.
- Connected real Chrome reloads the existing signed-in OWNER account detail
  page successfully; its read-only controls remain intact. The rendered
  desktop screenshot was inspected. No account, role, payment, provider usage
  or email was changed by this acceptance check. No viewport override was used.
- The webapp-testing workflow drove the focused light/dark browser checks;
  computer-use confirmed the existing real-Chrome session without signing the
  owner out. Staged redacted secret scanning covers only this change, not the
  historical public-repository exposure. No public GitHub push was made.

Ignored browser artifacts remain in
`frontend/test-results-release-preview-revocation-{local,preview,live}-{light,dark}`.

## Limits

This is durable revocation for account-preview sessions, not a new database
session system for ordinary JWT logins. Copied ordinary non-preview JWTs still
follow the existing credential-version and expiry rules after local sign-out.
Already-admitted requests cannot be recalled. Grant retention cleanup, broader
read-handler review, role-change step-up and account erasure remain separate work.
