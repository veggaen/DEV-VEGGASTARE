# Veggat production scoreboard

Evidence is recorded per slice; a passing HTTP response is not proof of feature completion.

## S1 — First impression (DONE)

- DONE locally and live: public home, product story, isolated demo sign-in/logout at 390 and 1280.
- DONE locally: Products makes one initial request after filter metadata settles; header remains the same DOM node through link navigation; no whole-app loading fallback reappears.
- DONE locally: footer absent on home/Products; moved into page flow elsewhere. Further route checks pending.
- Auth prerequisite: plain-cookie impersonation authorization removed; forged-cookie regression returns 403 and preserves the QA identity. Automatic cross-provider email linking is disabled; link explicitly from a signed-in account.
- Money prerequisite: legacy new-order/payment creation paused. Do not advertise checkout as ready until S4.
- Validation: 50 unit tests; S1 Playwright 4/4 and authenticated/security checks 6/6 both locally and live; production build passed. Touched-file lint has no errors. Deployment `dpl_GepfndFS7kRu9V1hEWy5wXoU11B9`.

## S2 — Authentication (in progress)

- Local AND live browser round trip passed: register → app-issued email verification → normal session → password reset → old-session revocation → reset-token replay rejection → password login → logout → 2FA. Callback origin assertion passed (3/3 including setup, both environments).
- Local AND live 2FA UI passed; direct password login without a code and replay of a consumed code both denied. Passwords were not emitted to browser console.
- Atomic reset/verification/magic-login token consumption; reset increments session tokenVersion. 2FA is validated in the exact credentials request, not through a shared confirmation row. Password-form logging removed.
- Durable HMAC-keyed auth throttling fails closed across replicas. Additive migration applied successfully. Migration commands now use the selected Neon's direct endpoint, preserve locking, and stop deployment if migration fails. One stale idle pooled connection holding the migration lock (no transaction) was terminated; no data deleted.
- Auth email links use configured AUTH_URL, including local production builds on port 3000. Canonical production aliases redirect before OAuth initiation. PKCE/state/cookie protections retained.
- Focused unit tests 44/44. TypeScript + production build and touched-file lint passed. Auth pages have no horizontal overflow at 390/1280 locally. Production deployment `dpl_DgeGqdcet7R354MBCg1PgPTpdys8` (commit `dde372b`) is READY and verified at www.veggat.com. Production alias redirects verified. All three local OAuth buttons reached provider login pages, S256 PKCE and localhost callbacks confirmed, no provider configuration error shown. Full owner OAuth consent/callback remains pending; GitHub owner action requested.
- Delivery testing uses [Resend's labelled test recipients](https://resend.com/docs/dashboard/emails/send-test-emails), not disposable public inboxes. Provider accepted sends; reading email-delivery history with the configured key returned 401. Tokens were read only for the isolated fixture from the database, then consumed through the real UI; inbox delivery to a human is not claimed.
- Migration connection rationale: [Prisma / Neon direct connections](https://docs.prisma.io/docs/orm/v6/overview/databases/neon). Network throttling uses [Vercel's forwarded-client header](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for).

## S3 — Marketplace (catalog/cart DONE; paid completion continues in S4)

- Seeded only two new, fixed-ID reviewer products and Veggat Studio; existing listings were preserved. Interview Pack: 29 NOK; AI credits: 39 NOK. Seed supports transactional `--dry-run`.
- Original AI-generated fjord artwork is disclosed as such. Optimized public gallery previews are deployed; full-resolution JPG/PNG and the actual TXT remain private and are not yet provisioned for paid delivery. See `showcase-artwork.md` for generation provenance.
- Local production build: home → normal demo sign-in → both product pages → add each → two separate cart lines → reload cart at 390/1280 passed (2/2 including setup). Images decoded successfully; no browser exceptions or horizontal overflow.
- Fixed session-loading cart redirect and exchange-rate-driven cart reloading. Storage SDK read-only initialization is permitted for demos; upload/delete remain denied. Both buckets reject anonymous/demo uploads. Employee permission reads require the signed-in identity. Removed PDP's blurred entrance and word-by-word title delay.
- Focused security unit tests 20/20; touched-file lint and production TypeScript/build pass. Deployment `dpl_7TauGWWHa2yaCHZJnMcBQJ9X4YbC` is READY; public gallery/PDP checked live at 390/1280 with no exceptions or overflow. Shared header/cart synchronization is being verified next.
- Additional QA: desktop gallery next button, cart increase/decrease/remove and empty-cart navigation work. The product page has no horizontal overflow at 360/390/768/1024/1280/1920/2560. Mobile gallery controls are swipe-only and metadata pushes the title too far down; polish tracked for S7, not claimed complete.
- Expanded test caught unstable PostgreSQL cart-row ordering after quantity updates; GET now sorts by creation time and ID. Header uses the existing CartProvider instead of a separate polling cache. Add/increment/decrement/remove update the badge and preserve row order. Expanded local test 2/2 passes; it reused an existing app-issued demo session after reaching the unchanged signup cap. Default/CI flow still creates a demo through the visible button.
- Listing search/clear works. Listing and cart have no page-level overflow at 360, 844×390 landscape and 2560. S7 visual backlog: Products' fixed decorative background overlays the non-positioned demo notice (washed-out contrast); isolate the page background or stack the notice above it. Mobile toolbar icon buttons need accessible labels; the catalogue heading still says “Freedom Store”.
- Final release `f2e68c7`, deployment `dpl_PJxBHUGyQunCL9pU2jvTdmvA2h9h`, is READY at www.veggat.com. Expanded marketplace test passes locally 2/2 (14.2s) and live 2/2 (27.8s), including setup. Live uses a fresh demo from the visible homepage button, both real product images, separate cart lines, reload at 390/1280, add/increment/decrement/remove badge synchronization, stable row order and demo upload denial. No browser exceptions.
- Remaining: checkout, paid order/receipt, seller order visibility, private signed downloads and credit grants (S4/S5). Do not claim this vertical slice is complete yet.

## S4 — Verified checkout (PARTIAL, demo verified local/live)

- Additive production database migration applied: server-side checkout attempts,
  unique capture/request IDs, separate environment credit ledgers and nonnegative
  balance constraints. No unrelated database objects removed.
- Server-priced 29/39 NOK SKUs, separate line items, two attempts/user/day,
  strict verified-capture amount/currency/order/payee binding, transactional
  fulfillment and replay protection implemented. Return URLs cannot grant goods.
- Real private JPG/TXT files provisioned; raw storage URLs deny unauthenticated
  access. Authenticated entitlement route checks ownership, completion, expiry,
  revocation and usage cap before returning verified file bytes.
- Local and live browsers: free demo checkout completed with both items, 0.00 NOK receipt,
  real JPG/TXT downloads, signed-out download 401, replay returns the same order.
  Demo purchase intentionally grants no paid balance; S5 free grant is pending.
- Payment/storage/entitlement unit tests **60/60**; database constraint checks
  **4/4** in a rolled-back transaction. No real or sandbox PayPal charge yet.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` remain missing.
  Normal payment CTA fails closed. Production values belong only in Vercel
  Production; local/preview use Sandbox. Refund workflow remains unfinished.
- S4 and responsive corrections deployed; current production commit `c965d86`,
  deployment `dpl_B1DDWufH2bBHurwbhyBTF8bomUy6`, READY at https://www.veggat.com.
  Actual Live PayPal is still unavailable; production environment-name listing
  reconfirmed all three required PayPal variables absent. No charge was made.

## S7/S8 — Restarted mobile audit (PARTIAL)

- See [responsive audit](responsive-audit.md) for real scrolling reproductions,
  fixes, screenshots, targeted tests and explicit coverage limits.
- Local Pulse/footer, dropdown, drawer, profile-tab and product mobile fixes
  verified in their recorded scope. Production build passed; focused browser
  regressions **4/4** (30.4s including setup), payment/storage/warehouse units
  **62/62**. Warehouses GET/refresh 200; mobile dashboard rail is hidden and the
  paper-trading demo is explicitly read-only. Final live regressions **4/4**
  (40.6s including setup). Actual live Pulse scroll→Polls test resets 700→0 and
  keeps footer at y=844 in an 844px viewport. Full feature audit is incomplete.
- Warehouse detail API now requires auth and omits inventory for USER/demo;
  local/live 401 anonymous and 200 with zero inventory for demo confirmed.
  Three new role-isolation unit tests pass. Detail UI now also uses the secured
  GET: local read/refresh/back navigation passed at 360/390/1280/2560; S8 regression
  2/2 including setup. Product filter Sheet/focus/scroll and category selection
  passed at 360/390/short landscape; focused local S3/S7 5/5 in 42.9s. Production
  build/TypeScript and touched-file lint passed. Final live S3/S7/S8 run **6/6**
  including setup in 1.0m, release `6b8adc1` / `dpl_ABEFDCXREp97puGonJb9PzvkFFqp`.
  Live warehouse phone screenshot confirmed a 44px refresh target and no overflow.

## S5 — Metered AI integration (demo debit/denial verified local/live; paid purchase blocked)

- Added reservation/refund state machine, one-time isolated demo grant, environment
  separation, daily quota and an independent bounded platform budget. No owner bypass.
- Real PostgreSQL tests in a disposable schema: concurrent last-credit spends,
  duplicate requests/refunds, interrupted reservation recovery, concurrent demo
  grants, exhausted budget, BYOK and database constraints. **19/19 tests passed**;
  touched-file lint and TypeScript passed. Temporary schema was removed; no real
  balance/order/provider call was touched.
- Additive migration applied. Main/participant chat, polls, answer verification
  and dictation cleanup now share guarded generation; titles are local and audio
  transcription is BYOK-only. Exact model allowance, byte/token/time bounds,
  failure settlement, one-time demo credits and disabled unavailable models added.
- Local real OpenAI debit and persistence revealed a client response-shape bug;
  fixed. Final local production browser run **5/5** in 49.2s, including setup:
  Groq debit to zero, subsequent premium 402, saved replies after reload, anonymous
  selector, Pulse/footer and AI drawers/transcript/composer reflow at eight sizes.
  No credits or request caps were reset to make tests pass.
- Focused AI/request/demo units **63/63**, with selected payment regression files
  **107/107**, plus real PostgreSQL ledger **19/19**. Build/TypeScript/touched lint
  pass. Release `cd99962` / `dpl_DMGSUQQ1DPgCfG1FUfvp955WHQtJ` is READY at
  https://www.veggat.com. Live real-provider browser test **2/2** (37.7s, including
  setup): two OpenAI Luna replies and one Groq reply persisted, five demo credits
  exhausted, then another premium request returned 402. No allowance was reset.
  Live non-spending regressions **6/6** (55.6s): AI at eight viewport sizes, model
  picker, contained drawer/transcript scrolling, Pulse/footer, product filters,
  separate cart lines and badge/reload behavior. Phone chat visually inspected.
- Corrected cramped phone chat header, competing viewport heights, outer-page
  auto-scroll and inaccessible custom drawers. Reused Radix Sheets with contained
  scrolling and focus restoration. Pricing no longer promises nonexistent
  subscriptions, alternate payment providers or unlimited AI.
- See [AI credit safety](ai-credit-safety.md) for invariants and remaining gates.

## S6 — Wallet/settings UI (PARTIAL)

- Phone Settings now opens the selected panel immediately; its 12 navigation
  items live in a focus-managed drawer. Desktop keeps a sticky, independently
  scrollable rail. Both reuse one section definition and keep URL state.
- Fixed demo payment settings' blocked-server-action spinner/crash. A read-only
  preview now explains payout restrictions. Normal payout requests handle errors,
  retry reads, label the email field, wrap actions and confirm removal. Added
  server-side demo payout denial; wallet ownership/verification checks retained.
- Wallet chooser constrains height and scrolling in short landscape, has a 44px
  close target and human cancellation/unavailable-extension states. All AppKit
  setup now uses one trimmed project-ID selection; absent IDs show guidance.
- Local production browser checks: drawer/rail/page scrolling, demo payout preview,
  injected test-wallet cancellation/connect/disconnect with preserved auth. The
  injected fixture cannot sign or send transactions. Local configured WalletConnect
  picker opened and escaped without an exception. All 12 Settings panels rendered
  at 390px without page exceptions or horizontal overflow.
- **30/30** focused payout ownership/configuration/demo-policy unit tests; final
  build, TypeScript and touched-file lint pass. Final local regression **6/6**
  (51.7s including setup): S6 plus AI reflow, Pulse/footer and marketplace cart.
  Release `050a407` / `dpl_5zHbhLJE3h2y8bRv2vJmd9E91aSr` is READY. First live
  regression run: **5 passed, 1 failed**. Opening the phone Settings drawer moved
  the background 112px on that run; a manual attempt reproduced it, while later
  attempts did not. Kept the failure recorded; removed the Settings entrance
  translation/fade and made opening focus explicit, with a pre-scroll assertion.
  Correction `d2c9bdf` / `dpl_F1Lj57Lhr1hHiyzPSTs9kYdcxwjp` is READY. Three
  consecutive fresh-context Settings checks passed locally **4/4** (40.7s) and
  live **4/4** (37.2s), including setup. Actual owner-wallet signatures, on-chain operations and normal-account
  payout saves are not claimed verified by the test-wallet flow.

## Feature scoreboard

| Area | Feature | Status / evidence |
| --- | --- | --- |
| Auth | Email login, session | DONE — current local/live browser round trips, revoked sessions rejected |
| Auth | Register, reset/verify, logout | DONE — current local/live UI round trips and token replay protection; human inbox delivery not independently confirmed |
| Auth | Google | PARTIAL — owner completed normal Chrome locally; automated browser blocked by Google |
| Auth | GitHub, Discord | PARTIAL — initiation checked, full consent/callback pending |
| Shop | List, PDP, images | DONE — both reviewer products and actual images verified locally/live |
| Shop | Cart | DONE — two lines, reload, quantity/removal, stable ordering and badge synchronization locally/live |
| Shop | Checkout | PARTIAL — local free demo UI completed; normal payment safely disabled without keys |
| Shop | Live PayPal, sandbox PayPal | BLOCKED on PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_WEBHOOK_ID; implementation and mocked validation done, provider transactions not run |
| Shop | Confirmation, signed download | PARTIAL — local/live demo receipt and actual JPG/TXT downloads pass; anonymous 401 and idempotent replay pass; paid verification blocked on PayPal keys |
| Shop | Cheap JPG+TXT product, credits SKU | PARTIAL — seeded at 29/39 NOK; paid fulfillment pending |
| AI | Chat, selector, streaming | DONE for current OpenAI Luna/Groq demo path, selector and persisted streaming replies local/live; current Astra/Grok paid generation still unverified |
| AI | Credit debit, zero balance, no overcharge | DONE for demo debit/402 local/live plus ledger concurrency/fuse tests; paid-credit purchase remains blocked on PayPal |
| Wallets | Connect UI, no crash | PARTIAL — injected-wallet cancel/connect/disconnect passes local/live; configured WalletConnect open/escape and configuration units pass; owner-wallet verification pending |
| Platform | Public homepage | DONE — S1 verified locally and live |
| Platform | Consent controls Analytics/Speed Insights | DONE — no scripts before consent/Essential Only; both 200 after opt-in; real visitor metrics pending |
| Platform | Health | PARTIAL — local Hapi `/v1/health` 200 and mock shipping returns two NOK options; Railway auth expired and live backend unverified |
| Quality | Touched-file lint | PARTIAL — run after each slice |
| Quality | Home → demo → product → cart E2E | DONE — local and live pass; payment coverage remains a separate S4 task |
| Quality | Payment mocked in CI | PARTIAL — S4 pending |
| Layout | Core path at 360 and 2560, other requested sizes, 125% zoom | PARTIAL — earlier 390/1440 smoke checks only |
| Interview | Root README | PARTIAL — public demo, optional 29/39 NOK SKUs, architecture, four decisions and S5 evidence documented; payment and walkthrough still pending |

## Environment and safety

- Backend follow-up: retired unauthenticated stock/Pusher endpoints (410), removed
  client-triggered inventory broadcasts, and reject legacy socket handshakes.
  Build and **5/5** Node boundary tests pass; actual local `/v1/health` remains
  200. Compatible lockfile patches reduce npm audit findings from 12 to 7;
  remaining Prisma-tooling advisories were not hidden with a major downgrade.
  This backend correction is **not deployed**: Railway owner authorization is
  required, and the first browserless login link expired. Live shipping access
  control/provider limits and active frontend warehouse events need further audit.
- Active frontend warehouse notifications now contain only an invalidation marker,
  never stock/product DTOs; list/detail clients refetch through role-filtered HTTP.
  No new public inventory subscription is opened for demo/ordinary users. Focused
  warehouse tests **7/7**, touched-file lint and production build/TypeScript pass.
  Local warehouse read/refresh/back-navigation at 360/390/1280/2560 **2/2** (6.4s,
  including setup). Live release check pending; privileged mutation itself is
  still not claimed tested by the demo session.

- Work is isolated in the `showcase/ai-revival` worktree; original dirty workspace preserved.
- Local OAuth origin is `http://localhost:3000`.
- Current local production-mode test process uses the live database. Test identities are isolated and non-admin; no Live PayPal keys are added to localhost.
- After the PC crash, Chrome inventory is empty and the native helper pipe is unavailable. Playwright is the active browser test mechanism, not the owner's Chrome. Do not spoof Google's browser checks or telemetry automation exclusions.
- Demo creates a separate temporary USER per visitor, bounded to five per daily IP fingerprint and 200 globally/day in a serialized transaction; sessions expire after a day. The S5 candidate permits guarded private chat creation/messages and five one-time credits. Cart/demo-checkout remain isolated; real payments, public posting and provider-key changes remain denied.
- New paid entitlements must never be granted from client prices or a return URL. S4/S5 remain release blockers.
- PayPal credentials are absent locally and in Vercel Production. Owner asked to create Sandbox credentials (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`) locally; Live credentials must stay in Vercel Production. `PAYPAL_WEBHOOK_ID` also remains absent. Dashboard inspection redirected to owner sign-in. No test or real charge has been made.
- Railway CLI is installed but `railway list --json` returns Unauthorized; the
  showcase worktree has no linked Railway project. Backend health/deployment
  cannot yet be verified. Real Chrome inventory is still empty; attempting to
  open Railway in Chrome reports `Browser is not available: chrome`.
- Payment implementation references: [PayPal environment separation](https://developer.paypal.com/api/make-api-requests), [Orders v2](https://developer.paypal.com/api/orders/v2), [idempotency](https://developer.paypal.com/api/rest/reference/idempotency/). Unsafe legacy capture/grant handlers now fail closed; webhook development bypass removed. Production webhook target is `/api/webhooks/paypal`.
