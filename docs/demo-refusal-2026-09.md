# Demo refusal recovery — 24 September 2026

## Change

The generic “Demo is busy” message hid whether a visitor should wait a minute
or return after the UTC day boundary. The normal Auth.js credentials flow now
returns three allowlisted, non-identifying refusal codes: short rate limit,
per-connection daily allowance, or global daily capacity. The client supplies
the readable message; arbitrary provider/server exception text is never shown.
The error panel offers product browsing and normal sign-in without payment.

The existing limits are unchanged: five accounts per connection/day and 200
globally/day, with the existing advisory transaction lock and short rate limit.
No identity reuse by IP, header spoofing, limit reset, shared account, credit
grant or production database change is introduced. Configuration/DB failures
continue to fail closed. Codes contain no email, IP, fingerprint or secret.

Reference: [Auth.js public credentials error codes](https://authjs.dev/reference/core/errors#credentialssignin).

## Verification status

- 30 demo provisioning/policy units pass. Boundary cases include 4/199 allowed,
  5 per visitor denied, 200 globally denied, short rate denial before DB access,
  missing configuration, DB failure, and unknown-code fallback.
- Touched lint has no errors; the existing hard-navigation-after-sign-in warning
  remains. That navigation is unchanged by this patch.
- The initial unit harness imported Next's server runtime; the test now uses
  the real Auth.js error class through its core export. The first build caught
  a nullable test result; the assertion was corrected.
- Production-style build and strict TypeScript pass locally. The two focused
  browser checks pass: all four refusal messages at 390/1280, eight intercepted
  callbacks with no identities provisioned, a working catalog escape link, no
  page errors or horizontal overflow, and the existing daily cap through the
  real Auth.js callback with no authenticated session granted.
- Test harness corrections account for callback query strings, Next's separate
  route-announcer alert, and Auth.js's null signed-out session response.
- First Preview deployment passed the refusal browser fixture. The added auth
  regression caught Preview sending OAuth callbacks to production: the URL
  override was scoped to the old `showcase/ai-revival` branch, not the current
  `release/showcase-september` branch. Added a Preview-only branch override for
  the existing stable Preview origin; production is untouched.
- The same branch mismatch omitted `PAYPAL_WEBHOOK_ID`. Read-only Sandbox API
  lookup verified the existing stable-Preview webhook and completion/refund/
  reversal subscriptions, then its ID was assigned to the current branch's
  Preview environment. No webhook subscription or payment was created.
- The second CLI deployment still omitted both branch-scoped values; its
  unchanged callback-host and webhook-503 failures disprove that adding the
  branch settings alone fixed this deployment path. A third Preview deployment
  explicitly supplies only `AUTH_URL` and the verified existing Sandbox
  `PAYPAL_WEBHOOK_ID` at build/runtime. Do not apply these overrides to a
  production deployment. Full branch-metadata selection diagnosis remains open.
- Explicit-settings Preview `dpl_52SXaPka2Kp7nCgdcJsWWCHfH4MZ` is READY at the
  stable Preview alias. Strict build passed against isolated jolly-smoke with
  no pending migrations. All **3/3** focused checks pass (17.3s): phone/desktop
  refusal recovery, webhook malformed/unsigned rejection, and auth callback
  host/PKCE/cookies/malformed-session checks. This is not full OAuth consent or
  a new Sandbox capture/refund acceptance. Live acceptance remains pending.
- The webhook regression reproduced 503 on the prior deployment. Acceptance
  requires malformed input 400 and unsigned input 401; neither fixture reaches
  fulfillment. All 16 webhook verification/reconciliation units pass.

This does not prove successful fresh-demo provisioning after the cap resets,
or full auth/payment acceptance. Production still uses the prior verified app.
