# Showcase validation — 22 September 2026

## Measurement baseline

Vercel Web Analytics and Speed Insights were already enabled. No subscription or billing settings were changed.

The seven-day production query returned 10 page views and only five usable LCP samples: two for the gate, two for the homepage, and one for the auth-error page. This is not enough to represent normal visitor performance. The reported P75 LCP was 21,124 ms for the gate and 1,904 ms for the homepage. Do not use these small samples to claim a site-wide speed improvement.

A same-machine, cold-context local gate comparison measured:

| JavaScript resource metric | Before shell split | After shell split |
| --- | ---: | ---: |
| Requested files | 57 | 19 |
| Encoded body bytes | 970,902 | 231,497 |
| Decoded body bytes | 3,373,220 | 779,470 |

This is a 76% reduction in transferred JavaScript for the gate. It is not a measured 76% reduction in page-load time. Repeat field measurements after deployment and sufficient consenting visitor traffic.

## Local checks completed

- Production build, including TypeScript validation.
- 38 Vitest tests, including telemetry consent and URL minimization.
- 21 selected unauthenticated Playwright checks; three authenticated-only checks skipped in that run.
- Five authenticated Playwright checks, including gate setup, password sign-in, wallets, notifications, and conversations.
- Homepage, Products, Pulse, and Messages at 390 px and 1440 px: successful responses and no document-level horizontal overflow. This is a layout smoke test, not an exhaustive accessibility audit.
- Anonymous Gemini chat: streamed response displayed in the browser.
- Authenticated OpenAI GPT-5.6 Luna and Grok 4.7: successful UI requests using one-time keys, without saving those keys.
- An ordinary account without paid entitlement received HTTP 402 when requesting platform-funded OpenAI.
- Model search and selection changed the active model.
- Essential Only: no Vercel telemetry scripts loaded, including after reload. Explicit analytics opt-in loaded both scripts.
- Google OAuth completed in the owner's normal Chrome after correcting local `AUTH_URL` to the registered port 3000. GitHub/Discord initiation succeeded, but full provider sign-ins have not been verified.

## Test identity and security

An owner-authorized QA account was provisioned directly with role USER, a random hashed password, no orders, and no paid entitlement. Its address uses the reserved `example.test` domain; it is not a real verified mailbox. The provisioning timestamp permits normal credential authentication for this fixture only. It is not a public demo login.

The local production-mode server uses the live database. This account is therefore shared with production; do not promote it to admin or use it to make real purchases. Credentials are in ignored `frontend/.env.test.local`; saved sessions are under ignored `frontend/e2e/.auth`. Neither is uploaded to Vercel.

Login and registration no longer log submitted form values. Existing historical logs were not erased. Do not log or publish credentials, cookies, or Playwright traces containing authentication data.

## First live deployment checks

Commit `6b4dc37` deployed successfully to `www.veggat.com` as `dpl_9JBqM8Ko9EgJ54Sh9c6eP1fLDpH2`.
Anonymous Gemini returned a streamed answer. The QA account signed in through the password form. OpenAI GPT-5.6 Luna and Grok 4.7 returned streamed answers through the signed-in chat using one-time keys. The keys were disconnected afterward; no keys were saved to the QA account. Live wallets, notifications, and conversations returned HTTP 200.

Both Vercel telemetry scripts returned JavaScript with HTTP 200 after explicit consent. Their delivered code intentionally excludes `navigator.webdriver` and Headless user agents, so no event-ingestion claim is made from the automated browser. Do not bypass this filter; confirm future ingestion from consenting normal-browser visitors.

## Follow-up polish validation

The Groq catalog incorrectly marked the provider as BYOK-only even though the server supports its platform key. The selector now allows signed-in users to select Groq subject to existing quotas. A regression test verifies the active label changes without opening key entry. A local UI request returned HTTP 200, provider GROQ, model `openai/gpt-oss-20b`, cost tier `free`, and the expected streamed answer.

The follow-up production build and all 38 unit tests passed. Seven selected authenticated Playwright checks passed, including the new selector regression. Homepage entry fades and the floating development notice were removed; development disclosure remains in the footer. Cookie-preference switches now have accessible names. No public demo gate or paid-credit checkout was enabled by this change.

## Remaining acceptance work

- Real-visitor telemetry ingestion and representative field measurements.
- Full GitHub and Discord OAuth round trips in a supported browser.
- Sandbox PayPal checkout, order fulfillment, and seller visibility.
- Atomic AI-credit reservations, authoritative prices, verified payment amounts, idempotent credit grants, model allowlists, and spending caps before launching new paid-credit products.
- Broader route and accessibility audits, realistic performance sampling, and a short interview walkthrough.

The single paid-access denial test does **not** establish that credit accounting is safe under concurrent requests or that payments are production-ready.
