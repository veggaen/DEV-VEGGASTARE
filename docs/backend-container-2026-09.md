# Backend container readiness — 24 September 2026

## Result

Local readiness **PASS**; Railway deployment **ACTIVE** after the owner restored
the Hobby plan. This is not full-app acceptance.

## Railway recovery

The restored old `main` build failed loading its build context. The service was
switched to `release/showcase-september` (no changes to billing, resource limits,
network exposure or secrets). Release `3234d9b` deployed successfully as
`46cb526c-8c5e-4560-b5d1-abd537a70f35`.
Live `/v1/health` returned 200; both retired mutation endpoints returned
410 / `LEGACY_ENDPOINT_RETIRED` / `Cache-Control: no-store`.
Startup logs confirm production mode, HTTP 3001, WS 3002 and no CORS origins.

The first shipping smoke check returned 502: the pre-existing `BRING_MODE=live`
attempted Bring and received an authentication failure. Only `BRING_MODE` was
changed to `mock`; deployment `6edc4888-6a6b-4fef-a1c6-5a0ba0276104` succeeded.
Repeat live checks passed: health 200, both retired routes 410/no-store and
shipping 200 with `provider: mock` and two options.
Live Bring remains unsupported until its credentials and access/rate
controls are verified. No actual shipment or payment was created.

## Earlier billing blocker (resolved)

The connected Railway workspace, “Vetle Gudman's Projects,” displays “Trial
expired.” VeggaStare / DEV-VEGGASTARE displays “Limited Access” and “No active
deployment.” Its service root is `/backend`, Dockerfile builder, start command
`node dist/index.js`, health check `/v1/health` (120 seconds). The displayed
config source was old commit `9e5fb72c6b1bdba16786ab000588f223fc27657a`.
At that point the deployment branch was not verified and no settings had been
changed. The recovery above supersedes that earlier blocker.

## Changes

- Replace the old Node 20 image with `node:22-bookworm-slim`. Node 20 is EOL;
  Node 22 is supported ([official lifecycle](https://nodejs.org/en/about/previous-releases)).
- Build TypeScript and run all five security regressions in the Linux build stage.
- Start the final runtime as `node` (UID/GID 1000), with production mode enabled.
- Exclude host-generated Prisma output and private/test artifacts from context.
- Add an explicit-port loopback-only runtime smoke script.

## Verification

- Fresh `npm ci`, then `npm test`: TypeScript build and **5/5** tests pass.
- `docker build -t veggat-backend:showcase-20260924 .`: **PASS**, including
  **5/5** Linux security tests. Base image resolved to
  `sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c`.
- Isolated container, no mounted files or credentials, `BRING_MODE=mock`,
  random host ports bound only to 127.0.0.1. `id` confirms non-root UID 1000.
- `node tests/container-smoke.cjs 58036 58037`: health 200, mock rates 200,
  retired mutation routes 410/no-store, socket polling 403. **PASS**.
- The initial inline smoke command hit Windows argument-quoting syntax, before
  making requests. Replaced with the checked-in script; that script passes.
- A suspected production-install/Prisma issue was **disproved**: clean
  `npm ci --omit=dev` generates Prisma successfully, also in the Linux build.
  No dependency or lockfile changes were needed.

## Deployment handoff

Railway now follows `release/showcase-september` with auto-deploy enabled, as
before on `main`. Future pushes can redeploy this service. Keep
`BRING_MODE=mock`, set explicit allowed frontend origins only if browser access
is needed, and repeat health/retired endpoint checks after backend changes.
Live Bring requires separate authorization/rate-limit work.
No database or Pusher secret is needed by the current HTTP/socket handlers.

No Vercel redeploy is required for these backend-only changes. PayPal Sandbox
authentication and the 9 NOK capture check remain pending. **No Live payment
has been tested or confirmed.**
