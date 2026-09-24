# Preview deployment preflight

The September release exposed two silent Preview configuration regressions:
OAuth initiation used the production callback, and PayPal webhook requests
returned `WEBHOOK_NOT_CONFIGURED`. The environment overrides belonged to an
older branch. Adding current-branch overrides alone did not correct CLI builds;
explicit build/runtime values did, verified by deployed regression tests.

## Guard

`frontend/scripts/migrate-deploy.mjs` now validates hosted Preview configuration
before spawning Prisma migration commands. It requires an explicit HTTPS auth
origin and rejects known production domains, the Vercel production hostname,
localhost/loopback, embedded credentials, paths, queries and fragments. Errors
name the problem without printing values.

If any PayPal field is present, all three must be present: `PAYPAL_CLIENT_ID`,
`PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`. Preview must use Sandbox values.
This presence check cannot prove a credential's PayPal environment or account;
Sandbox token authentication and webhook lookup remain separate release checks.
An intentionally payment-disabled Preview with all three absent is allowed.

Production and localhost behavior are unchanged. Existing isolated-Preview DB
validation remains authoritative for database selection. This guard does not
relax cookie, PKCE, signature, capture, credit or fulfillment checks.

## Current CLI deployment requirement

Until branch metadata/environment selection is resolved, the showcase Preview
deploy must explicitly supply `AUTH_URL` and its existing Sandbox webhook ID
to both `--build-env` and `--env`. Use the stable Preview origin:

`https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app`

Keep the app's existing webhook registered at that origin plus
`/api/webhooks/paypal`. Do not create another webhook for each deployment URL.
Never reuse these overrides for `--prod`. Do not put client secrets in CLI
arguments or commit local environment files. Existing Vercel Preview credentials
remain stored in Vercel; the deployment override carries no PayPal client secret.

## Verification

- `node --test scripts/preview-deployment.test.mjs`: **5/5** pass, covering valid
  and invalid origins, every incomplete payment-field combination, local and
  Production no-op behavior, and the actual migration entrypoint exiting before
  Prisma for invalid Preview configuration.
- Touched-file lint: no warnings or errors.
- Correctly configured hosted Preview `dpl_9xqUPPTrByyiWKHgTtstbbAh84Mp`
  (source `1096ea5`) passed its strict build and preflight against isolated
  jolly-smoke, with no pending migrations. Stable Preview alias updated;
  deployed auth protocol and unsigned/malformed webhook checks **2/2** pass.

## Real Google consent follow-up

After the owner signed into PayPal, Sandbox Accounts became accessible. The
retained Preview app session was a payment-disabled demo, so normal Google
sign-in was attempted. Google returned `redirect_uri_mismatch` for the exact
stable Preview `/api/auth/callback/google` URL. The matching existing OAuth
client in the VeggaStare project has production and localhost callbacks but no
Preview callback. After explicit owner confirmation, the exact Preview callback
was added to “Web client VeggaStare”; Google displayed “OAuth client saved”.
All six existing redirect entries were checked unchanged before saving.
The subsequent browser sign-in attempt reached an extension security-warning
page targeting Preview `/nexus`. Automation stopped at that warning without
bypassing it. Owner inspection is required; successful authenticated application
access and Sandbox payment remain unverified. Initiation protocol tests passing
does not imply provider consent/callback acceptance.

The previous live runtime remains verified; this build-only change does not
claim a new payment, OAuth consent flow, or full application acceptance.
