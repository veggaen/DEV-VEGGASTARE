# Account preview revocation — September 2026

## Change

Every new read-only preview has a server-owned `AccountPreviewSession` record.
Its random ID binds the owner, member, both credential versions and the original
one-hour deadline. No bearer cookie is stored. Auth.js checks the record on every
preview-session validation; ordinary sessions incur no additional grant lookup.
Missing, ended, expired or mismatched grants cannot become ordinary member sessions.
Legacy preview tokens without the new ID require a fresh sign-in.

End Preview atomically marks exactly that grant ended and writes its audit before
returning an owner cookie. Replaying a copied/renewed preview cookie can no longer
restore the owner or authenticate as the member. Concurrent End requests have one
winner. Audit or encoding failures roll back the grant change and return no new
cookie. Ending one preview does not revoke independently issued previews.

The migration is additive, with expiry/principal constraints and foreign keys.
Deleting a user through a future retention-safe workflow also removes their
temporary preview grants, not the separate audit records. No existing user or
ordinary session is changed by this migration.

This follows the server-side invalidation principle in the
[OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#manual-session-expiration).

## Verification so far

- 161 focused tests pass across Auth.js sessions, preview service, admin detail,
  proxy and installed-library parser regressions. Real Auth.js cookie handling
  returns null and clears ended/missing/legacy preview cookies.
- Six real PostgreSQL tests pass in a disposable schema using the actual new
  migration: issuance/restoration/replay, failed-audit rollback, concurrent End,
  independent-grant isolation and credential revocation against issuance.
  Cleanup removes only the validated disposable schema.
- Touched ESLint and diff checks pass. Initial type checking caught an
  ExtendedUser-to-record argument mismatch; the call now passes an explicit
  minimal object. The rebuilt production bundle and full TypeScript pass.
- Actual localhost:3000 HTTP/UI acceptance passes: two disposable principals,
  real start/end endpoints and encrypted cookies, copied-cookie session and
  restoration replay denial, owner-version revocation and exact audits. UI start/
  end works at 390/1280 without intercepted responses. Cleanup removes exactly
  those two users, cascading only their preview grants, and their test audits.
- Local light 3/3 and dark 3/3 pass with zero skips/retries: real anonymous/demo
  denial, browser-only preview recovery, keyboard return and account/settings
  regression at eight sizes. Real Chrome still renders the existing signed-in
  local Account Settings; no setting was changed.
- Both Preview and production remote builds pass. The additive migration is
  applied in both databases, bringing the migration count to 54. No customer
  preview, provider generation, payment or email was triggered.

## Deployed acceptance

Runtime `bd0b5ad`:

- Isolated Preview `dpl_DNE14atBGx9dJrX3PbAie3jQAhCb`, immutable
  `https://dev-veggastare-anukbsuu6-v3ggas-projects.vercel.app`, is assigned to
  the existing Sandbox alias. Health reports healthy. Light 3/3 and dark 3/3
  pass, zero skips/retries. An initial runner launch used the repository root
  instead of frontend and executed no tests; the corrected runs are these results.
- Production `dpl_fb63nooZX4SXo5c4EMVeK4cLewZt`, immutable
  `https://dev-veggastare-pvmmbj8q3-v3ggas-projects.vercel.app`, passed its health
  check before promotion. CLI inspection confirms `www.veggat.com` resolves to
  this release. Live light 3/3 and dark 3/3 pass, zero skips/retries.
- Connected real Chrome reloads the existing Live OWNER account detail page
  successfully, preserving its read-only controls. No customer account was
  impersonated or edited. No viewport override was left active.
- Hosted tests exercise actual anonymous/demo denial and browser-only recovery
  fixtures. Positive replay/revocation acceptance uses actual local HTTP/Auth.js
  with disposable principals, not a production customer.
- Staged redacted secret scan passes for these changes only. No public GitHub
  push was made; historical repository remediation remains separate.

Ignored artifacts: `frontend/test-results-release-preview-revocation-*` and
`frontend/test-results-release-impersonation-http`.

## Limits

This change proves End Preview revocation, not global JWT logout revocation.
Ordinary Sign Out still clears the current cookie; other copies of an active
preview remain subject to credential versions and its one-hour deadline unless
End Preview consumed the grant. Already-admitted in-flight reads cannot be
recalled. Remaining read-handler review, security step-up and retention-safe
account erasure are separate work. Ended grants currently remain as minimal
records; a bounded retention/cleanup job is not part of this slice.
