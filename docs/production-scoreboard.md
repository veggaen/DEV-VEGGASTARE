# Veggat production scoreboard

Evidence is recorded per slice; a passing HTTP response is not proof of feature completion.

## S1 — First impression (in progress)

- DONE locally: public home, product story, isolated demo sign-in/logout at 390 and 1280; current live checks pending.
- DONE locally: Products makes one initial request after filter metadata settles; header remains the same DOM node through link navigation; no whole-app loading fallback reappears.
- DONE locally: footer absent on home/Products; moved into page flow elsewhere. Further route checks pending.
- Auth prerequisite: plain-cookie impersonation authorization removed; forged-cookie regression returns 403 and preserves the QA identity. Automatic cross-provider email linking is disabled; link explicitly from a signed-in account.
- Money prerequisite: legacy new-order/payment creation paused. Do not advertise checkout as ready until S4.
- Validation: 50 unit tests; S1 Playwright 3/3 and authenticated/security checks 6/6; production build passed. Touched-file lint has no errors.

## Feature scoreboard

| Area | Feature | Status / evidence |
| --- | --- | --- |
| Auth | Email login, session | PARTIAL — QA passed previous local/live build; revalidate changed auth |
| Auth | Register, reset/verify, logout | PARTIAL — full current round trips pending |
| Auth | Google | PARTIAL — owner completed normal Chrome locally; automated browser blocked by Google |
| Auth | GitHub, Discord | PARTIAL — initiation checked, full consent/callback pending |
| Shop | List, PDP, images | PARTIAL — public list works but empty; fixtures/PDP pending |
| Shop | Cart, checkout | PARTIAL — legacy new orders fail closed during verified-checkout replacement |
| Shop | Live PayPal, sandbox PayPal | PARTIAL — no payment made; environment verification and server-priced orders pending |
| Shop | Confirmation, signed download | PARTIAL — verified-capture/entitlement tests pending |
| Shop | Cheap JPG+TXT product, credits SKU | PARTIAL — not seeded |
| AI | Chat, selector, streaming | DONE (previous deployment) — local/live Gemini, Groq, OpenAI/Grok one-time-key UI tests |
| AI | Credit debit, zero balance, no overcharge | PARTIAL — existing premium denial tested; atomic ledger/fuse not implemented |
| Wallets | Connect UI, no crash | PARTIAL — actual connect/disconnect/missing-config tests pending |
| Platform | Public homepage | PARTIAL — S1 in progress |
| Platform | Consent controls Analytics/Speed Insights | DONE — no scripts before consent/Essential Only; both 200 after opt-in; real visitor metrics pending |
| Platform | Health | PARTIAL — frontend checked previously; Hapi `/v1/health` pending |
| Quality | Touched-file lint | PARTIAL — run after each slice |
| Quality | Home → demo → product → cart E2E | PARTIAL — needs demo inventory; CI payment mock pending |
| Layout | Core path at 360 and 2560, other requested sizes, 125% zoom | PARTIAL — earlier 390/1440 smoke checks only |
| Interview | Root README | PARTIAL — human README exists; demo and live SKU details pending |

## Environment and safety

- Work is isolated in the `showcase/ai-revival` worktree; original dirty workspace preserved.
- Local OAuth origin is `http://localhost:3000`.
- Current local production-mode test process uses the live database. Test identities are isolated and non-admin; no Live PayPal keys are added to localhost.
- Native Chrome is readable, but click geometry/screenshot capture currently fails (`SetIsBorderRequired`, `0x80004002`). Playwright is the active browser test mechanism. Do not spoof Google's browser checks or telemetry automation exclusions.
- Demo creates a separate temporary USER per visitor, bounded to five per daily IP fingerprint and 200 globally/day in a serialized database transaction; no shared password/account. Demo mutations are restricted to its cart and logout, and sessions expire after a day. Demo AI stays blocked until atomic grants and the platform fuse ship in S5.
- New paid entitlements must never be granted from client prices or a return URL. S4/S5 remain release blockers.
