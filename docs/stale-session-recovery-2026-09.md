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

Hosted patch deployment/acceptance is pending. Full external-provider callbacks
are not implied by the protocol tests: a subsequent real-Chrome local GitHub
attempt reported `Invalid Redirect URI` for
`http://localhost:3000/api/auth/callback/github`. Its configured OAuth application's
callback must be inspected without replacing or breaking the production callback.

Artifacts: `frontend/test-results-release-stale-session-{local,preview,live}-baseline/`
and `frontend/test-results-release-stale-session-local/`.
