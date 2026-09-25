# Read-only account preview — September 2026

## Scope and changes

Account preview is limited to a current OWNER viewing an ordinary, non-demo
USER. Start rechecks the owner's session version and the reviewed target's
updated timestamp under ordered PostgreSQL share locks. Session encoding and
the required audit record must succeed before a cookie is issued. Failures do
not report a successful switch or leak exception details. Old chunked session
and unsigned preview metadata cookies are cleared.

Encrypted preview claims bind both accounts' credential versions and an
absolute one-hour deadline, which Auth.js rolling renewal cannot extend.
Deleted users, changed roles, revoked credentials and expired/legacy claims
produce a null session instead of falling back to an ordinary member session.
Returning to the owner requires the same current proofs and an audit record.
Origin validation, bounded strict input, durable throttling and no-store
responses apply; the existing admin gate still protects starting a preview.
Ending a valid preview remains possible after that gate cookie expires.

The proxy blocks writes, Server Actions and identity-linking requests in preview,
including known legacy GET mutations and private file delivery. Normal sign-out
remains available. The banner sits below the header, wraps long names, provides
44px actions and shows retry/sign-out recovery if returning fails. Identity
switches deliberately use a full navigation to discard the previous client cache.

## Local verification

- Touched-file ESLint and `git diff --check`: pass.
- Strict production build: pass, localhost:3000; isolated Preview database and
  authenticated Sandbox PayPal credentials only. No Live PayPal keys locally.
- 98 focused tests across auth-session, impersonation service, proxy perimeter
  and installed Auth.js parser regressions: pass. Includes real encrypted-cookie
  Auth.js session-handler checks that owner/target revocation and expiry return
  JSON null and clear the cookie.
- Three isolated PostgreSQL tests: pass. Disposable schema only, real signing
  and audit writes, unavailable audit table fails closed, credential-revocation
  update serializes against issuance and invalidates the earlier version.
  The test schema is removed by the test's validated cleanup.
- Playwright local light **3/3**, dark **3/3**, zero skips/retries: real anonymous
  and demo start/end denial; browser-only preview-banner recovery and keyboard
  return; regression of account/profile security forms. Sizes: 360x800, 390x844,
  844x390, 768x1024, 1024x1280, 1280x800, 1920x1080 and 2560x1440. No horizontal
  overflow; banner does not cover menu; 44px End Preview action. Screenshot
  inspection includes phone and desktop. Fixtures intercept mutation responses;
  they do not prove a real customer's owner-restoration flow.
- Connected real Chrome: existing local signed-in security page renders at
  390x844, scrolls to its footer and keeps Update Security Settings accessible.
  No setting, password, purchase or customer account was changed.

## Deployment acceptance

Pending isolated Preview and Live validation for this runtime.

## Explicit limits / next work

This is a scoped security improvement, not completion of the full account audit.
Real owner-to-member UI acceptance remains unperformed. Known side-effectful GET
paths are denied; the remaining read handlers still need broader review.
Ending preview replaces the current cookie; a copied encrypted preview token is
not individually revoked by that action and remains bounded by the absolute
deadline and both credential versions. Per-preview server-side revocation is a
separate enhancement. Old preview cookies without the new proof fields expire
on validation; ordinary sessions are not intentionally invalidated.

Privileged user-detail edits/deletion, verified email replacement and retention-
safe erasure remain separate unfinished work. No production customer was
impersonated, deleted, emailed or charged by these checks.
