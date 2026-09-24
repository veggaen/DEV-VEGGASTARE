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
- Preview and Live acceptance of this patch remain pending.

This does not prove successful fresh-demo provisioning after the cap resets,
or full auth/payment acceptance. Production still uses the prior verified app.
