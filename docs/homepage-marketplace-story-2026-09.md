# Homepage marketplace story — local and live verification

## Changes

- Lead the below-fold section with digital products and their purchase/delivery
  flow, with prepaid AI as a supporting feature and Pulse/trading labelled as
  experimental. Remove stale model-count and trust-tier marketing claims.
- Give each feature link a unique accessible name, visible keyboard focus and
  a minimum 44px target. Preserve the existing design and hover effects.
- Keep animated heading letters grouped by word so mobile headings do not break
  inside “discovery”. Preserve the screen-reader text and reduced-motion logic.
- Correct the signed-in homepage Settings link from `/nexus` to `/settings`.

## Evidence (2026-09-24)

- Touched-file ESLint and `git diff --check` pass.
- Strict local Next.js production build passes, using the isolated Preview
  database and authenticated Sandbox PayPal credentials, with no Live keys.
- Two focused Playwright tests pass (19.3s): public headings and all three
  feature-link destinations at 360, 390, 1280 and 2560 pixels; retained demo
  session clicks Settings and reaches `/settings`.
- Public navigation produced no page errors or horizontal page overflow at
  those sizes. Mobile 360px and ultrawide 2560px screenshots visually inspected:
  heading words stay intact; feature cards stack on mobile and remain centered
  in three columns on ultrawide.
- The earlier signed-in test failed because it clicked before cookie consent
  was dismissed. The test now waits for the visible consent choice and hydrated
  menu before clicking; it does not bypass application behavior.

## Limits / next verification

Production deployment `dpl_96gLAzdykhhDeEbsNSH3qDYVyPf3` (source `a6ba219`)
passed its strict build; the 49 production migrations had none pending.
The public four-size navigation test passed on its candidate alias (30.2s)
before promotion and on `https://www.veggat.com` after promotion (19.1s).
Vercel inspection of the live domain confirms this deployment. Real Chrome's
existing signed-in owner session also loaded the new story and followed the
homepage Settings link to `/settings`, where Settings/Profile headings rendered.
No payment, credit, setting or cart data was changed during these checks.

This is not evidence that every
route, animation, provider login or payment flow works. Existing wider motion
and all-route interaction audits remain open. Hosted Preview sign-in is awaiting
owner inspection of a browser-extension security warning; do not bypass it.

Focused command (frontend directory, existing isolated demo storage state):

```powershell
$env:E2E_MARKETPLACE_STORY='1'
$env:E2E_DEMO_STORAGE_STATE='.private-showcase/release-local-demo.json'
$env:E2E_BASE_URL='http://localhost:3000'
node node_modules/@playwright/test/cli.js test e2e/suite.spec.ts --project=no-auth --workers=1 --retries=0 --no-deps --reporter=list --trace=off --grep 'S1 marketplace story|S1 signed-in homepage Settings' --output=test-results-release-home-story-local-final
```
