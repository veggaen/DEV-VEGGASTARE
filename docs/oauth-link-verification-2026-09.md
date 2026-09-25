# Account-link verification — 25 September 2026

## Fixed behavior

- Connected, awaiting confirmation, unconfirmed/expired and verified are distinct.
  Both the checklist and account badges require a linked account AND its server
  verification flag. Unknown providers never inherit a verified badge.
- `oauthConfirm` query strings cannot invent success. Provider diagnostics are
  allowlisted, and denied browser storage does not break the settings screen.
- Send email is a real authenticated server action, not another OAuth sign-in.
  It uses only the account's stored email, rotates the pending token and reports
  provider failure without exposing diagnostics or claiming inbox delivery.
- Existing email URLs now make a read-only redirect to an explicit confirmation
  screen. GET/scanner visits cannot consume tokens or remove accounts. The action
  requires the matching signed-in account, an unexpired one-use token and an
  existing provider link. Opening a link while signed out first requires login.
- Confirmation/removal updates and token consumption are transactional. A user
  row lock serializes competing actions across providers. Removing the last
  known password/Google/GitHub/Discord sign-in method is rejected.
- Demo actors cannot mutate links or send mail. All three actions share the
  existing durable, fail-closed auth throttle. Next's Server Action origin
  validation remains enabled; the legacy unlink POST also checks same origin.
- Email names are escaped. Copy correctly distinguishes verification score from
  login access: the existing Auth.js Account association already permits login.
  This change does not claim to quarantine OAuth login until email confirmation.

## Evidence

- Focused units: **55 passed** (OAuth state/actions, auth throttle and feedback).
- Isolated Neon PostgreSQL: **2 passed**. Eight concurrent uses of a token apply
  exactly once; simultaneous removals of two providers leave one sign-in method.
  Tests use a disposable `qa_oauth_*` schema, mock auth/mail/recalculation, and
  remove only that schema afterward. No production data or real mail changed.
- Initial database fixture omitted Prisma's `updatedAt`; corrected the fixture,
  then reran successfully. No application assertion was loosened.
- Initial browser check hit the intentional demo block on the old mutating URL.
  Updated test checks its now-read-only redirect anonymously and renders the
  destination using the real demo session. The demo guard stays unchanged.
- Local browser recovery check: **1 passed**, five viewports (360, 390, 844
  landscape, 1280, 2560), both themes, no page overflow/exceptions, truthful
  badges, failed-send recovery, forged feedback and cancel-without-mutation.
  API states and failed send are browser fixtures, not claimed provider sends.
- Touched-file lint and final strict webpack/TypeScript build pass (188 static
  pages). Final local browser batch **3/3 passed**, 12.5s, no retries/skips:
  verification/recovery plus the existing public auth-feedback light/dark tests.
- Real Chrome read-only local inspection confirmed Google/GitHub remain awaiting
  email confirmation; no provider was unlinked, confirmed or emailed during QA.
  The final build's inert-token review and Cancel were also checked in Chrome.
  Live deployment/acceptance is pending.

## Remaining acceptance

Real confirmation-email send/inbox round trip remains unverified. No email was
sent under the separate delivery-webhook setup approval. Positive Discord
consent and linked-account login still need their own explicit owner action.
Stored experimental Reach scores may predate completed checks; this patch does
not rewrite all users' tiers or present those scores as proof of identity.

References: [Next.js Server Action security](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/data-security.mdx),
[Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines).
