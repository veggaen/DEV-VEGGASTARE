# Invalid-session recovery

## Reproduction and cause

Real Chrome on localhost remained on `/nexus` with “Redirecting to sign in…”.
An expired/invalid JWT was returned with `sub: undefined`. Auth.js therefore
produced a non-null session without a user, and `useSession()` reported
`authenticated`. The workspace's unauthenticated sign-out effect never ran.

The same browser regression failed before the patch on local, isolated Preview
and Live using disposable/previously expired demo sessions, not owner sessions.
No real account, balance or provider permission was changed.

## Correction

The JWT callback now returns `null` for absent subjects, missing users, revoked
versions, expired demos and invalid impersonation owners. This invokes Auth.js's
normal session termination and cookie clearing. Valid-user behavior, cookie
attributes, CSRF, PKCE, provider scopes and session-version checks are unchanged.
The installed Auth.js session handler and the [official callback API](https://authjs.dev/reference/core#jwt)
were checked; no vendor patch or weakened authentication was introduced.

## Evidence

- Baseline: 5 of 7 invalidation unit cases failed; stale-session browser checks
  failed locally, on Preview and Live.
- After patch: 8 callback/real-handler tests pass, including JSON null and cookie
  deletion. The other focused auth tests pass (26); touched-file lint and strict
  production-style build pass.
- Local browser: all 3 focused checks pass (stale-session recovery, malformed
  sessions/OAuth cookie-host checks, password login/protected routes/logout).
  Recovery and password checks cover 390 and 1280px.
- The originally stuck real-Chrome tab now reaches the working login form after
  reload. No manual cookie deletion or authentication bypass was used.

Hosted acceptance passes: Preview `dpl_HYATp3FnCWFuqgBMwVskvC2HoWYL` (3/3)
and Production `dpl_7Qme9rWWkaYXxAUEM7D1sU7rS6sT` (2/2). The main domain was
inspected after promotion. The password-user test now waits for `/profile/:id`,
not the intermediate `/profile` redirect, before its next navigation. A first
Preview run caught this test synchronization issue; the corrected run passes.

Full external-provider callbacks are not implied by protocol tests. The subsequent
real-Chrome checks now establish local Google and GitHub callbacks separately:

- Local GitHub originally reported `Invalid Redirect URI`: local configuration
  used the production OAuth client rather than the existing `veggastare-dev` app.
- With owner confirmation and owner-completed GitHub 2FA, a development secret
  was generated and saved only in ignored local test configuration. The local
  launcher loads that client/secret. Production and Vercel secrets are unchanged.
- A logged-out GitHub attempt then correctly returned `OAuthAccountNotLinked`.
  Email equality did not silently merge accounts.
- Real Chrome Google sign-in reached `/nexus`. With separate owner confirmation,
  Settings -> Verification -> Link GitHub attached the identity while signed in.
- Local logout -> Continue with GitHub -> `/nexus` -> profile passed; the profile
  resolves to the same isolated test account as Google. Database read-only checks
  confirm both provider links. PKCE and dangerous-email-linking protections remain.
- Provider-link email confirmation / trust-tier badges remain pending; no inbox
  delivery or production provider-link change is claimed.

Artifacts: `frontend/test-results-release-stale-session-{local,preview,live}-baseline/`
and `frontend/test-results-release-stale-session-{local,preview-final,live}/`.
