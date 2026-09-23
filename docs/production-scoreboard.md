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

- Mobile/first-paint follow-up: rebuilt account entry around consistent 48px/16px
  labelled fields, visible provider names, bounded forms and no opacity-delayed
  essential content. Removed impossible anonymous avatar upload and obsolete
  cross-tab redirect. Async pending/failure handling now spans the full request.
  Request-rendered auth and readiness-guarded inputs prevent skeleton-only first
  paint and lost pre-hydration input. Auth's hidden-header offset no longer brings
  the footer into view early. Full local focused batch **18/18**, auth/scroll unit
  tests **30/30**, touched lint and production build pass; live rollout follows.

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

## S7 — Messages follow-up (local/live verified)

S7 Messages follow-up: improved mobile list/composer, accessible fields, read-only
demo state and caught search/send failures with draft retention. A browser scroll
test exposed the creation form incorrectly using the immersive transcript shell;
corrected. Production build/TypeScript/lint pass; local focused browser **3/3**
(9.2s) including eight viewport sizes and mocked transport failure. Shell regressions
also pass locally **4/4** (42.5s): Settings, AI and Pulse/footer. Release `8a410a5` /
`dpl_CSfnTPogxR24AfB47kgKeTkDa2Wh` is READY at www.veggat.com. Live combined
regressions **6/6** (58.8s including setup) and phone visual review pass. Actual
member-to-member delivery remains separate from the mocked error test.

## S7 — First-render speed (local/live verified; more speed work remains)

- Removed the global client-only wallet render barrier while preserving the
  provider tree; browser preferences restore after matching server/client markup.
  Network synchronization waits for restored preferences. Homepage heading and
  chat intro no longer wait for delayed entrance animation.
- Provider/config/event units **8/8**, production build/TypeScript/touched lint
  pass. Initial core regression **8/8**, final paint/wallet/AI regression **5/5**,
  and explicit reduced-motion/pre-bundle regression **3/3** pass locally.
- Two cold-context 20s lab observations (390px, 4× CPU, 1.6 Mbps/150ms) report
  LCP **2,564 / 2,624ms**, CLS **0**. Same-condition old live sample: **14,700ms**.
  Local/live bundlers and network differ; these are not field percentiles.
  Release `2778cb2` / `dpl_CyqBXU5FnH83fPpf5P3dihaWBThL` is READY. Live
  focused regressions **7/7** (49.3s): pre-bundle paint, reduced-motion hydration,
  injected-wallet lifecycle, AI, Messages and actual Pulse/footer/drawer scrolling.
  Two same-host 20s lab observations report LCP **7,528 / 6,044ms**, FCP **6,632 / 5,168ms**,
  CLS **0**. Paint no longer waits for wallet hydration, but server/network latency
  and JavaScript weight still need work; this is not a Core Web Vitals pass.

## S8 — Companies follow-up (local/live verified)

- Compact responsive directory, persistent heading/results and retry, role-aware
  demo setup preview, currency-correct storefront and honest server-rendered
  activity summary. Non-public products are excluded from the storefront query.
- Normal creation form keeps its submit lock/draft on error; server demo denial,
  admin-only user-directory fetching and payload-log removal added.
- Production build/TypeScript/touched lint pass; focused units **25/25**. Browser
  directory/detail/navigation/scroll/error coverage **4/4** (11.4s); expanded form
  reflow/failure **2/2** (5.5s). UI-only creation requests are fully intercepted,
  so actual company creation/team invitation is not claimed. Release `e6dcb6f` /
  `dpl_6a76C651Gpg4NWBXmZjB2xBh6wPb` is READY. Live Companies plus Pulse/footer
  regression **5/5** (37.5s); live phone visual inspection also passed.

## S7 — Navigation and Pulse footer follow-up (local/live verified)

- Explicit mobile Menu button with 44px target; optional wallet UI split from the
  initial top-bar bundle without replacing providers or sessions. Email debug log
  removed. Build/TypeScript/lint pass; focused local browser regression **8/8**
  (50.4s), including wallet lifecycle and actual drawer/footer scrolling.
- Wallet panel chunk only requested on menu open. Local LCP 2,708ms / CLS 0 lab
  sample is roughly unchanged; no major speed gain claimed.
- Live `cc9e5db` verification caught a reduced-motion hydration error (3/3
  reproductions). Fixed server/first-client motion snapshots and stable text
  markup in the hero/topbar/lower sections; semantic heading text replaces
  letter-by-letter accessible names. Lower homepage sections no longer wait
  for opacity entrances. Five hook/provider unit tests pass.
- Actual infinite-feed scrolling exposed a footer flash missed by finite
  fixtures. Footer now waits for the final cursor; delayed/error batches retain
  scroll position and offer retry. Superseded filter requests abort, and an
  empty filtered batch offers an explicit check-more control.
- Final Webpack build/TypeScript/touched lint pass. Local browser **10/10**
  (47.4s), live **10/10** (1.1m): Settings, wallet lifecycle, pre-bundle paint,
  hydration at 390/1280, Pulse/drawer scrolling, delayed pagination/retry and
  marketplace/cart. Release `3a8f0cc` / `dpl_B8hWfk6B1Pfw1BBArndAeL2P1Mg9`
  is READY at www.veggat.com. Actual live feed scrolling has no horizontal
  overflow/console exceptions; Polls resets a deep scroll to 0, and checking
  the next empty-filter batch successfully reveals real poll cards.
- Extra live hydration regression **7/7** (16.2s, setup plus three repeats at
  each of 390/1280px), with no hydration errors. The Analytics follow-up is below;
  this is not a full-app completion claim.

## S8 — Analytics growth and publishing mix (local/live verified)

- Hub and three growth reports now use the existing bounded layout and tokens,
  mobile-sized controls, explicit fictional previews for non-admin visitors,
  accessible daily data tables and truthful range/creation-count labels.
- Admin-only APIs still deny demo users; browser previews send no private metric
  requests. Admin reports validate responses, cache per user, retry explicitly
  and identify stale data on refresh failure. Chart code loads separately.
- Fixed UTC-midnight daily iteration (today could previously be omitted) and
  deterministic capped query ordering; the 10,000-record cap is disclosed.
- Final production build/TypeScript and touched lint pass. Units **16/16**;
  localhost browser **5/5** (16.5s including setup), real page/table/sidebar
  wheel scrolling at 390/1280, date controls and all eight viewport sizes through
  2560px without horizontal overflow. Admin UI is a browser fixture, not real
  elevated access; real demo requests still return 403.
- Initial release `c929ec7` / `dpl_EJDBb1jcJMvMr94tWtCKKzo19Di3` is READY at
  www.veggat.com. Live browser **5/5** (21.3s); deeper actual Users-page scrolling
  then found an old, differently styled second chart and unrestricted aggregate
  endpoint. Expanded regression fails on that old page. Follow-up brings both
  sections inside one shell, preserves explicit non-admin samples, protects the
  endpoint with admin/auth/rate limits, and replaces unbounded identity reads
  with database counts. Targeted units now **20/20**. Final local follow-up
  build/TypeScript/lint pass and expanded browser **5/5** (23.6s); real local
  publishing-mix request by the demo user returns 403.
- Follow-up `10c00ad` / `dpl_FmYLPXbffVtaGYQAGTmSGpsPXTtc` is READY at
  www.veggat.com. Expanded live browser **5/5** (34.2s) passes. Each of the three
  growth pages is wheel-scrolled at all eight target sizes. All four APIs return
  401 anonymously; real demo publishing-mix access is 403. Settled live phone
  visuals have aligned sections, one H1, no overflow or JavaScript exceptions.
- Next: crypto's duplicated footer and price controls.
  Real Chrome/OS zoom/phone keyboard and the remaining route audit are pending.

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

### S8 Crypto follow-up — local/live verification

- Removed the duplicate footer and unified the historical-price page with the
  responsive analytics shell. Labelled 48px filters, stable lazy chart geometry,
  accessible paginated table, contained scrolling and explicit experimental copy.
- Canonical daily history is validated/cached hourly per allowlisted asset and
  currency; date/weekly/monthly filtering is calendar-accurate and client-local.
  Both API paths enforce bounded inputs, rate limits, timeout and redacted errors.
- **38/38** analytics units and touched lint pass. Initial build/TypeScript pass;
  expanded local analytics browser regression **9/9** (34.4s). Actual local
  provider reads succeed for all three assets and three currencies tested, with
  cache reuse confirmed across date filters and the legacy alias. Eight requested
  sizes, page/table/drawer scrolling and late-response isolation covered.
- Final chart-axis/contrast build and TypeScript pass; targeted local browser
  **5/5** (15.7s), plus the preceding combined run **9/9** (34.8s).
  Release `6f9a804` / `dpl_F8CpxqRgrmtkZENRUpszL8dMKVz3` is READY at
  www.veggat.com. Live combined regression **9/9** (44.9s); actual provider
  reads for the same five pairs are 200, with 365 observations and shared-cache
  reuse confirmed. Live phone table/footer and ultrawide screenshots inspected;
  one footer, no page overflow/JS exceptions and contained real table scrolling.
  Whole-app audit, real Chrome access, physical keyboard and 125% browser zoom
  remain incomplete. Next: verified Pricing/Info link defects and remaining routes.

## S7/S8 — Pricing, Info and shell scrolling (local/live verified)

- Server-rendered Info now presents the marketplace story, free demo flow,
  architecture and a real Contact section. Pricing links to the correct AI Keys
  settings section; both pages share bounded gutters/canvas and readable text
  without delayed opacity/glow loops. The design/animation audit retained only
  lightweight reduced-motion-aware hover feedback.
- Fixed delayed contact fragments, hard-load restoration and whole-document
  anchor jumps that hid the demo notice. Only page/drawer scrollers move; early
  scrolling before hydration is preserved instead of resetting to the top.
- Production build/TypeScript/touched lint pass; helper units **9/9**. Local
  browser **16/16** (1.6m, including setup): all eight target sizes, real scrolling,
  links/auth callback, delayed scripts, Pulse/footer, Products, Settings, AI,
  Messages and hydration. Release `69b28f5` /
  `dpl_FPtEEKqcze5djFprwV1QLvTSxUW3` is READY at www.veggat.com. Final combined
  live browser **16/16** (1.7m) passes. Live Contact reload/footer and 2560px
  Pricing visuals confirm a stationary document and centered 1280px canvas.
- First live batch was 15/16: an intermittent 11px Product-filter background
  difference was measured across the whole click sequence. Follow-up separates
  pointer-down from drawer opening and wheel input; five live repetitions
  **6/6** with setup and local **2/2** pass with zero movement at each stage.
  Original intermittent movement remains in the audit, not silently discarded.
  Pricing card price baselines also have a small remaining alignment refinement.
- Owner Chrome remains unavailable after a fresh inventory and open-tab attempt.
  Full-app completion, physical keyboard/125% Chrome zoom, paid checkout and
  owner OAuth consent are not claimed. Remaining auth-page layout and AI Keys
  management findings are recorded in the responsive audit.

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
| Layout | Core path at 360 and 2560, other requested sizes, 125% zoom | PARTIAL — core route/drawer/scroll tests include 360/390/landscape/768/1024/1280/1920/2560; all-route interaction, real phone keyboard and actual Chrome 125% zoom remain unverified |
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
  including setup). Release `4c85955` / `dpl_DdBBcvSXMvPD7Eb4VJUn7EAXFt2p`
  is READY at www.veggat.com; live warehouse regression **2/2** (9.5s including setup).
  Selected payment tests **15/15** also pass. Privileged inventory mutation itself
  is still not claimed tested by the demo session.

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
