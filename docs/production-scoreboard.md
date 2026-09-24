# Veggat production scoreboard

Evidence is recorded per slice; a passing HTTP response is not proof of feature completion.

## Current integrated production release — 24 September 2026

Transactional email follow-up: **PARTIAL**, implementation/build/local browser
verified; deployment acceptance in progress. Real sending is **BLOCKED** because
the configured Resend key returns 401. See [email outbox evidence and exact
boundaries](transactional-email-acceptance-2026-09.md). Do not count provider
fixtures as delivered customer mail or mark the seller-review inbox complete.

PARTIAL: `release/showcase-september` combines Showcase consent/refund/custom-credit
work with the newer production currency-filter and basket fixes. Local strict
build, touched lint, 235 focused units, six rolled-back checkout scenarios and
30 ledger/configuration tests pass. Deployed Preview acceptance is **10/10**;
the integrated release is now on www.veggat.com at
`dpl_4hQNe5XcwtEx5SipwmYLkHdmcgXV` (source `ffc112b`, following integrated release
`32b4b1c`). Live selected browser
acceptance is **8/8**, including the actual OpenAI/Groq debit and server-enforced
zero-balance check. Real Chrome also verified four providers in Preview and the
live mobile product/footer and Live checkout display without paying. The first
live AI attempt hit a cookie-banner test race; it made no provider call and the
corrected normal-consent journey passed. Live money acceptance and legal delivery
follow-ups remain PARTIAL, not implied by the demo result. A focused loading/demo
guidance follow-up passes **3/3 locally, 3/3 in Preview and 3/3 live**, with no
additional provider or payment requests. Deployment and browser acceptance
are recorded in [the release note](integrated-release-2026-09.md). Historical
deployment entries below are not the current release authority.

Buyer withdrawal/problem notices and private original acknowledgments now ship
on the receipt. **190 payment/demo units**, **3 real isolated-Postgres cases**,
and **2/2 local, 2/2 Preview, 2/2 live** focused browser journeys pass. UI-review
guidance informed labelled controls, keyboard focus, retained error drafts and
360–2560 responsive/scroll checks. A malformed HTTP 200 cannot claim a saved
notice. Demo QA creates no paid refund and leaves payment status unchanged.
Actual email/full-agreement delivery, seller review operations, legal review and
owner Live purchase approval remain **PARTIAL**. See
[buyer-request evidence and rollback](buyer-request-acceptance-2026-09.md).

## Production security hotfix — 24 September 2026

- A separate worktree/branch `fix/production-security-september` starts from
  production `88729d0`; only frontend dependency manifests and release notes
  change. No custom-credit, currency, payment, auth-policy or schema changes
  were included. Commit `37866d8` / deployment
  `dpl_7jL8ZAP6MDY5xRdEWCHJA2Sj4A5u` is READY on www.veggat.com, veggat.com and
  dev-veggastare.vercel.app. Next.js 16.3.6, Auth.js and compatible runtime fixes
  now reach production; runtime audit **0 critical/0 high/25 moderate**.
- Production-source unit tests **72/72**, strict local/Vercel builds, local
  browser **7/7** and live browser **6/6** pass. Live health/home/products/login
  are 200; unsigned PayPal notification is 401 `INVALID_SIGNATURE`. No pending
  database migration was applied. Real Chrome retains the owner's live session,
  loads products and scrolls the 390px catalog without horizontal overflow.
- This does **not** release the newer global currency/custom-credit UI from
  Preview. Those remain at verified candidate `d5d3bad`, with **7/7** checks on
  both local and Preview. Localhost:3000 is restored to that newer build. No
  Live purchase has been made. PayPal Developer still needs owner passkey login;
  hosted GitHub CI remains blocked by the account billing lock.
- Rollback reference remains `dpl_CfYkdh23aWaFe5CMQuM8kQ6M96tw`. Moderate runtime
  and dev/build findings are follow-up work, not an all-clear security audit.

## CI and release audit — 23 September 2026

- `883ab64` adds the isolated interview workflow: empty loopback PostgreSQL,
  synthetic catalog, strict production-style build and focused demo/retry/replay
  browser path. No production DB or payment/AI secrets are supplied. Local
  browser **2/2**, CI target guards **12/12**, touched lint and strict type-check
  pass. README now reflects configured keys, verified Sandbox transactions and
  still-unverified Live acceptance rather than the obsolete missing-key claim.
- GitHub run `35925329121` was rejected before any step: account locked due to
  a billing issue. Hosted CI is **BLOCKED on owner billing resolution**. No
  billing settings were changed and the workflow is not claimed remotely green.
- The initial production-dependency audit found 4 critical/8 high/26 moderate
  entries. The security candidate updates Next.js 16.3.6, NextAuth beta.32 and
  Prisma adapter 2.11.3 (deduplicated Auth core 0.41.3); the audit now reports
  **0 critical/5 high/26 moderate**. Remaining findings still need review.
  Strict local build, five installed-token-parser checks, 93 focused unit
  checks, 30 isolated PostgreSQL ledger checks and two browser runs **5/5 each**
  pass. Auth recovery fixtures now refuse the live DB. Real Chrome retains its
  demo session and switches receipt USD (ETH) correctly. Candidate `477e83b`,
  deployment `dpl_7meZLg3agnyw1ALukw4nANB1xTYi`, is READY on the stable Preview
  alias after explicitly updating the pinned alias. Deployed browser **9/9**
  passes (auth/recovery/2FA, demo checkout retry/replay, currency/history/wallet
  and private-session checks). Health 200; unsigned webhook 401. Production is
  unchanged. See [security release evidence](security-release-2026-09.md).
- Follow-up candidate resolves the 0-versus-5 demo balance presentation without
  granting from receipt/history or replenishing an existing spent balance.
  Shared read-only presentation: 62 focused unit tests, 30 isolated ledger
  tests, strict build/type-check/lint and local browser **7/7** pass. Real Chrome
  confirms the 390px receipt and history agree. Compatible Axios/WebSocket/
  Socket.IO parser/brace-expansion fixes bring the production dependency audit
  to **0 critical/0 high/25 moderate**; build/dev findings remain separately
  tracked. Candidate `d5d3bad` / `dpl_31QwjyymHZVHk8UdGDQBT4v8MCTf` is READY on
  the verified stable Preview alias; deployed browser **7/7**, health 200 and
  unsigned webhook rejection 401 pass. Real Chrome confirms USD (ETH) and menu
  focus return. Production is unchanged. PayPal Developer remains at owner
  passkey sign-in; no further paid acceptance was attempted.

## Custom credit quantities — verified local/Preview candidate, 23 September 2026

- Integer credit selection (100–1,000) is shared by the PDP, header basket,
  full cart and checkout. Marginal 5%/10% discounts have no price cliffs.
  Server-owned integer-ore quotes freeze the exact quantity and price version;
  clients cannot submit prices. Existing 100-credit carts remain compatible.
- Unsaved/invalid drafts block every checkout entry point, including edits in
  the header basket. Cross-surface stale quotes require review. The existing
  two-attempt cap remains; a serialized 500 NOK daily exposure cap and conservative
  contribution guard were added. No caps or balances were reset.
- Additive `CartItem.creditAmount` migration applied only to the isolated Neon
  Preview branch. Real Chrome caught the old 68 NOK database checkout constraint;
  a second migration updates its bounded ceiling to 391.70 NOK (the maximum
  supported mixed cart), without changing past purchases. The local Sandbox launcher requires that isolated database,
  even for a production-style build; it refuses production endpoint fallback.
- Local custom-credit Playwright flow **2/2** and currency/history regression
  **3/3** pass including setup. The custom path tests 122/555, rejects invalid
  amounts, checks 360/390/1280/2560 overflow, rejects a stale checkout and creates
  a free demo receipt with the exact 122-credit line. It does not grant paid
  credits or contact PayPal. Focused unit tests **168/168** and touched lint pass.
- Real Chrome confirms typed 555, persistence and NOK (ETH) after changing from
  USD (ETH), and now completes its free 555-credit order. Its receipt accurately
  shows zero charged and no purchased credit grant; phone receipt/footer scrolling
  is verified. A new opt-in PostgreSQL regression prepares 122, 555 and maximum
  mixed carts using the actual constraints; all synthetic writes roll back.
  That integration test, final strict webpack build, strict type-check (8 GB heap)
  and touched lint pass. The first standalone type-check exhausted the default
  4 GB heap; the bounded 8 GB rerun passed, without suppressing diagnostics.
- Release `d640b2b`, deployment `dpl_Ax3eErQ96wEndT5Khk6PLCx3ohQk`, is READY on
  the stable showcase Preview alias. Its webpack/TypeScript/migration build passes.
  Deployed custom-credit Playwright **2/2** and currency/history **3/3** pass,
  including setup. Real Chrome confirms the deployed 555-credit USD (ETH) →
  NOK (ETH) switch also updates savings, access count and scrolled specifications.
  Health is 200; an unsigned capture notification is rejected with 401
  `INVALID_SIGNATURE`. No grant is inferred from that rejection probe.
- Actual custom Sandbox capture/webhook replay/refund and production remain
  pending. The PayPal Developer session expired when opening Sandbox Accounts;
  the account sign-in/passkey page is left open for the owner. The existing
  Sandbox app/key is reused; this is not a provider free-tier limit.

## Global currency presentation — verified locally and on Preview, 23 September 2026

- Shared `PriceAmount` renders selected fiat followed only by selected crypto in
  parentheses. `NONE` removes the secondary amount. Product listings/PDP, cart,
  mini-cart, checkout, receipts, orders, company storefronts, pricing, job budgets
  and shipping estimates use it. Mixed listing currencies convert separately
  into one display subtotal. Seller/company APIs expose stored order currency, rather
  than assuming historical orders were NOK. Unknown currencies/rates are not
  silently valued at 1 USD. Original captured amounts remain unchanged and are
  available under receipt payment details; display conversions are not quotes.
- Preference patches now merge with existing settings. Previously, selecting
  fiat could reset crypto and unrelated appearance preferences to defaults.
  Radio semantics, 44px targets, keyboard/Escape focus return, persistent
  two-part selection, bounded scrolling and an explicit Done action replace the
  old closing-on-every-selection menu. Mobile now has the header selector too.
- Formatter tests **18/18**, expanded currency/history/order/payment tests
  **81/81**, touched lint and strict local/Preview builds pass. Real Chrome
  confirms USD (ETH) / NOK (ETH), checkout, actual Sandbox order details and the
  existing paid receipt without another payment. Browser regression found and
  fixed the hidden mobile selector and an early click before hydration. Final
  local focused checks **4/4** and isolated Preview checks **3/3** pass (including
  setup): preferences/reload, products/cart/checkout/receipt/orders/pricing,
  mixed NOK/EUR totals, job-budget fixtures, keyboard focus, No Crypto and
  360/390/768/1024/1280/1920/2560 widths plus 844×390 landscape; checkout removal locking is
  local-only. Buyer history also verifies sign-in and the zero-session demo.
  A hidden streaming segment is excluded by scoping its label to the main UI.
- The mini-cart subtotal now shares the same fail-closed conversion helper;
  reduced motion, labelled quantity/removal controls and Escape focus return
  are included. The final local focused rerun is **4/4**, including short-landscape
  menu scrolling and basket focus/motion checks; screenshots were reviewed.
  Final deployed rerun is **3/3**; real Chrome also validates its product selector.
  Its scrolled specifications revealed a seeded fixed-NOK price string; the
  specification now uses the canonical product amount/currency and shared
  formatter. Local **4/4** and Preview **3/3** reruns include this regression.
  Real Chrome confirms USD (ETH) in the purchase area and scrolled specifications.
- Release `4fde28d`, Preview `dpl_4hXg2wb5WsRj7XndJhhA4y4YKTGX`, is READY on
  the stable showcase alias. A free demo checkout created its receipt through the normal app path;
  no PayPal request or real payment. Production remains `88729d0`.
- Custom credit quantities/volume discounts are tracked in the candidate section
  above. Verified Web3 checkout is separate unfinished work; selecting a crypto
  display does not enable payment.

## Current PayPal/credit follow-up — Preview candidate, not in production

- DONE: real Chrome connected. Existing PayPal Live `veggastare` and Sandbox
  `Default Application` reused. Approved Live webhook saved with completed,
  refunded and reversed events. Production-only Live credentials/webhook and
  Development-only Sandbox credentials saved as Vercel secrets.
- DONE: real Sandbox checkout for 39 NOK/100 credits and 29 NOK/JPG+TXT.
  Both server-verified captures are COMPLETED. Credit return replay left exactly
  one purchase grant; downloaded files match the stored SHA-256/size and anonymous
  requests return 401. No Live money spent or artificial credit grant/cap reset.
- DONE: real credit-funded replies through the Chrome model picker: OpenAI Luna
  debited 2 credits (100 → 98), Grok 4.7 debited 8 (98 → 90), and GPT-6 Astra
  debited 60 (90 → 30). A further Astra request was denied at 30 without an extra
  reservation. UI preflight now preserves the draft and disables unaffordable sends.
- PARTIAL: refund/reversal reconciliation and credit adjustments implemented;
  two active generations/account enforced atomically. Isolated Postgres and
  generation/receipt tests **52/52** pass. The first concurrency run caught an
  older test that created six simultaneous holds; it now races the permitted two
  alongside purchase/refund updates. No public balances were edited by tests.
- PARTIAL: receipt file links exposed a real Chrome blocked-navigation state;
  library blob transfers worked and delivered both files. Receipt transfers now
  reuse that same bounded, auth-checked in-page flow with visible retry feedback.
  Credit-only receipts link directly to AI, and cancellation preserves the cart
  without asserting payment state from the query string.
- DONE: strict candidate webpack/TypeScript build and 187 generated pages passed
  with an 8 GB process heap (the initial 4 GB TypeScript worker exhausted memory).
  Focused Playwright checks **5/5** pass, including credit/draft recovery, receipt
  retry, refund notices and landscape AI drawers. Screenshots were inspected.
  Updated real-Chrome receipt transfer delivered the TXT without leaving the page;
  its downloaded SHA-256 matches the private original.
- DONE: isolated schema-only Neon `veggat-paypal-sandbox` created on the existing
  Free plan. All 115 application tables were empty; 45 schema-verified migrations
  were baselined and Prisma reports no pending migrations. Synthetic QA identities,
  company, products and private originals are provisioned without copied user data.
  Preview-only database and Sandbox PayPal secrets saved in Vercel. Production
  settings unchanged. Preview isolation guard tests **7/7** and touched lint pass.
- DONE: release `91f1fbe` deployed to Preview, with both strict builds passing.
  Final deployment `dpl_9raz9RMLCkv8zzqaztb8xt3qKTc1` is READY on the existing
  showcase branch alias, with a branch-scoped `AUTH_URL`. Focused payment and
  isolation units **80/80**, a refreshed local strict type-check and lint pass.
- DONE: owner-approved domain-only Preview protection exception saved. Public
  Preview health returns 200 and the configured listener rejects unsigned events
  with 401 `INVALID_SIGNATURE`. Project-wide protection and billing are unchanged.
- PARTIAL: Sandbox webhook `4D346436GJ973660K` registered and read back with
  exactly completed/refunded/reversed capture events. Its ID is saved as a Secret
  for Preview branch `showcase/ai-revival` only. The first CLI redeploy remained
  503 (missing runtime variable). A fresh candidate deployment explicitly binds
  that Sandbox webhook ID and canonical AUTH_URL at build and runtime. Its
  unsigned-event rejection is verified; actual PayPal delivery, refund and replay
  acceptance remain unverified.
- DONE locally and on Preview: owner-only credit reporting now reads the ledger,
  not legacy entitlement environment flags. LIVE/SANDBOX/DEMO filtering, available
  and reserved balances, refund adjustments, verified cash and provider ceilings
  are distinct. Fresh database OWNER authorization, rate limiting and private
  no-store responses apply. Reporting tests **13/13**, strict build/TypeScript,
  touched implementation lint and browser retry/filter/refresh/scroll checks pass.
  Layout checks cover 360/390/844/1280/2560; 390/2560 screenshots reviewed.
  Browser owner fixtures do not confer server access: actual demo API requests
  remain 403. Real Chrome owner UI independently shows Sandbox balance 30,
  70 credits charged for three replies and NOK 68 across two verified captures.
  Scrolling the report and sidebar preserves content. No new payment or grant.
- DONE: isolated Preview password buyer login, PDP and saved cart passed the
  focused browser test (2/2 including setup), with no payment or credit grant.
- DONE locally and on Preview: private buyer credit-history route, nine isolation/accounting
  units, strict build and browser sign-in/navigation/scroll acceptance pass.
- OPEN: actual Sandbox webhook/refund delivery;
  production deploy/Live micro-purchases, volume packs,
  actual provider billing reconciliation and commercially verified margins.
  [Reviewed commercial policy](credit-commercial-policy.md) records which Grok
  recommendations are adopted, qualified or deferred. This is not an all-green
  payment or profitability claim.

Latest wallet/PayPal follow-up: release `88729d0`, deployment
`dpl_CfYkdh23aWaFe5CMQuM8kQ6M96tw`, is READY at www.veggat.com, veggat.com and
dev-veggastare.vercel.app. Live browser **14/14 (1.8m)** passes; live mobile
wallet screenshots were reviewed. Both local/live health are 200/healthy and
unsigned anonymous webhooks return 503 `WEBHOOK_NOT_CONFIGURED`, not fulfillment.
Additional local AI/product-cart checks **3/3 (25.3s)** and three repeated
hydration/cancellation checks **7/7 (28.5s)** pass. No payment/provider AI call,
credit grant or owner-account mutation was made by this verification batch.

Optional AppKit startup and
automatic wallet reconnection no longer run for ordinary marketplace visitors.
Stable providers remain mounted. Local browser **12/12 (1.0m)** and focused
units **65/65** pass, with strict webpack/TypeScript. The batch includes
Products-to-Pulse request observation, hydration readiness, delayed picker
cancellation/retry, locked-wallet Set active cancellation/retry, unchanged demo
auth, and independent sidebar/Pulse scrolling. Wallet activation uses permission
requests only, never signatures or transactions. Mobile badge wrapping and
44px activation controls were visually checked. The pre-fix hydration test failed
as expected; an intermittent ignored first click prompted the readiness guard.

Touched-file lint passes except the large legacy `SidebarWalletPanel.tsx`, whose
full lint does not finish in bounded runs (also reproduced on unchanged HEAD).
Base lint and exhaustive-deps separately report no errors and one existing unused
disable warning there; this is **not** a full hook-lint pass. No lint rules were
disabled in the repository. Actual owner-extension prompts remain unverified.

PayPal postback verification now preserves the raw event JSON, rejects missing
signature fields before provider calls, and remains mandatory in Sandbox.
Example settings and [setup/acceptance guidance](paypal-setup.md) use the correct
`/api/webhooks/paypal` path and event. That deployed wallet release was verified
before PayPal credentials were configured. The current follow-up above supersedes
its earlier missing-credentials/browser-connection status; it does not change
that release's recorded tests into proof of Live checkout acceptance.

Latest verified follow-up: reproduced and fixed cold-load Pulse disappearance while a
closed poll module loads, plus the resulting early-scroll/footer jump. Optional
poll/import dialogs now load independently with cancellable fallbacks. Strict
build/TypeScript, touched lint and local browser **7/7 (33.7s)** pass; additional
capture run **2/2 (7.8s)** passes. Phone/landscape/desktop dialog screenshots were
reviewed. Release `2a8cf25`, deployment `dpl_BMgpgcA29mYdHh9gz3CTLAWqwYEC`, is
READY at all three main aliases. Live browser **7/7 (46.4s)** passes, including
independent sidebar scrolling and pagination/footer retry. A fresh real-data
390px cold-load wheel trace retained the feed for all 146 sampled frames,
preserved early scrolling (675px), and showed no footer flash or page error.
Live feed/dialog screenshots were reviewed; local/live health are 200/healthy.
This closes the reproduced Pulse cold-load regression, not the full app audit.

Previous verified follow-up: Profile uploads/storage boundary release `9d088f4`,
deployment `dpl_8XHLyTALxFrBkxtuc95eUeYQJKwN`, READY at all three main aliases.
Strict webpack/TypeScript, touched-file lint, **68/68** units, local browser
**9/9 (1.1m)** and live **9/9 (1.6m)** pass. Includes actual avatar/banner retry,
private multipart upload/download, stale-session/anonymous/foreign-user denial
and focused Profile/navigation/Pulse scrolling. Only disposable QA accounts and
files were created/removed; no owner profile, paid entitlement or cap changed.
An independent live cold-load Pulse scroll then exposed a transient blank feed/
footer flash, absent from the settled-page fixtures. The subsequent `2a8cf25`
release above fixes that separately reproduced regression; the storage batch
alone was not a no-flicker claim.

Previous verified follow-up: Profile loading, real Connections, follow counts,
mobile alignment and controls shipped as `d2c3da0` /
`dpl_Au9r5r2W5FsCbxjgKQkxCs3gdn83`, READY at www.veggat.com. Final local browser
**9/9 (51.4s)** and live **9/9 (1.4m)** include shared header/sidebar, touch
settings and Pulse/footer regressions. Strict webpack/TypeScript, touched-file
lint and **35/35** focused units pass. Eight-size scrolling, real private-account
follow/unfollow and DM reuse, error recovery and light/dark screenshots verified.
No payment, credit grant, cap reset or owner mutation. All disposable Profile
fixtures removed. External image-storage upload and wallet-SDK navigation-abort
console diagnostics remain open; no full-app, native-Chrome or field-CWV claim.

Previous verified follow-up: Orders, receipts and downloads shipped as `e73a27b` /
`dpl_5ZmwRus2KfRMexm5MytTCVG2Sz1e`, READY at www.veggat.com. Final local browser
**7/7 (56.6s)** and live **7/7 (1.2m)** pass, including shared header/sidebar and
Pulse/footer scrolling regressions (counts include gate setup). Eight viewport
sizes, light/dark screenshots, refresh/error recovery, empty/expired/long-content
states and real private JPG/TXT downloads are covered. Demo orders now clearly
show 0 NOK charged and separate catalog value, not a paid 68 NOK order. No new
purchases, cap resets or credit grants. Strict build/TypeScript, touched-file lint
and **24/24** focused units pass. Full-app completion, Profile, owner OAuth
consents and missing PayPal credentials remain open.

Previous verified follow-up: Notifications API safety, responsive inbox and real
controls shipped as `c7611bc` / `dpl_AUTqoAT7yKb3tW4xL8AfDnyWNc3e`, READY at
www.veggat.com. Local browser regressions **12/12**, final styling recheck **3/3**,
live browser regressions **12/12 (1.5m)**, strict build/TypeScript, touched-file
lint and **50/50** focused units pass. Real-account checks found and repaired
stale archive/restore caching and a tooltip/popover Escape conflict. Eight sizes,
real wheel scrolling, dark/light screenshots, demo read-only and API ownership
are covered. See the responsive audit for scope and fixture cleanup. Profile
loading and remaining-route interactions still need review. This does not change S4's
missing PayPal secrets or imply that all routes/features are complete.

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
  tests **30/30**, touched lint and production build pass. Release `2c143df`,
  deployment `dpl_53ubXcvth4nMahFFNGG73tejaCLa`, is READY at www.veggat.com.
  Live: **18/19** initially; correcting the test's late-cookie-banner readiness
  yielded two passing complete auth-layout repetitions (**3/3** with setup).
  Every targeted case has now passed, including real recovery/2FA and shared
  Pulse/catalogue/cart regressions. All three OAuth buttons initiate locally
  and live; owner consent remains pending. See the audit for exact coverage.

- Local AND live browser round trip passed: register → app-issued email verification → normal session → password reset → old-session revocation → reset-token replay rejection → password login → logout → 2FA. Callback origin assertion passed (3/3 including setup, both environments).
- Local AND live 2FA UI passed; direct password login without a code and replay of a consumed code both denied. Passwords were not emitted to browser console.
- Atomic reset/verification/magic-login token consumption; reset increments session tokenVersion. 2FA is validated in the exact credentials request, not through a shared confirmation row. Password-form logging removed.
- Durable HMAC-keyed auth throttling fails closed across replicas. Additive migration applied successfully. Migration commands now use the selected Neon's direct endpoint, preserve locking, and stop deployment if migration fails. One stale idle pooled connection holding the migration lock (no transaction) was terminated; no data deleted.
- Auth email links use configured AUTH_URL, including local production builds on port 3000. Canonical production aliases redirect before OAuth initiation. PKCE/state/cookie protections retained.
- Focused unit tests 44/44. TypeScript + production build and touched-file lint passed. Auth pages have no horizontal overflow at 390/1280 locally. Production deployment `dpl_DgeGqdcet7R354MBCg1PgPTpdys8` (commit `dde372b`) is READY and verified at www.veggat.com. Production alias redirects verified. All three local OAuth buttons reached provider login pages, S256 PKCE and localhost callbacks confirmed, no provider configuration error shown. Full owner OAuth consent/callback remains pending; GitHub owner action requested.
- Delivery testing uses [Resend's labelled test recipients](https://resend.com/docs/dashboard/emails/send-test-emails), not disposable public inboxes. Provider accepted sends; reading email-delivery history with the configured key returned 401. Tokens were read only for the isolated fixture from the database, then consumed through the real UI; inbox delivery to a human is not claimed.
- Migration connection rationale: [Prisma / Neon direct connections](https://docs.prisma.io/docs/orm/v6/overview/databases/neon). Network throttling uses [Vercel's forwarded-client header](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for).

## S3 — Marketplace (catalog/cart DONE; paid completion continues in S4)

- Cart responsive/reliability follow-up: full mobile titles, independent 44px
  controls, original-currency subtotals, native product links, shared route/data
  skeleton, and centered 1280px canvas. Row-scoped locks/rollback, bounded reads,
  inline errors and checkout blocking handle uncertain updates without clearing
  content. Successful edits no longer require another GET. Focused units 11/11,
  touched-file lint and corrected production build/TypeScript pass. Initial
  browser batch 6/8, corrected new tests 3/3; combined local regression **8/8**
  (40.2s), expanded cart/scroll units **20/20**. Release `176fc7a` /
  `dpl_5HGMUdQXeZbQEsvuFuKCBJwNKzch` is READY at www.veggat.com. Live first
  batch **7/8** exposed the separate late-auth Pulse composer shift; after
  explicitly establishing auth for pagination-only checks, the combined live
  regression **8/8** passes (46.8s). Auth-delay geometry remains an open defect,
  not a claimed repair. Local pagination isolation recheck **3/3** passes.
  Separate 53px late-demo-banner shift remains explicitly tracked in
  the responsive audit. No payment or credit grant performed.

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
  Demo purchase intentionally grants no paid balance; S5 separately grants the
  isolated demo account a bounded one-time free allowance.
- Payment/storage/entitlement unit tests **60/60**; database constraint checks
  **4/4** in a rolled-back transaction. No real or sandbox PayPal charge yet.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` remain missing.
  Normal payment CTA fails closed. Production values belong only in Vercel
  Production; local/preview use Sandbox. Refund workflow remains unfinished.
- S4 and its initial responsive corrections shipped as commit `c965d86`,
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

### S7 Products follow-up — local/live verified

- Stable 1280px catalog canvas/H1, native product links, 44px mobile gallery and
  filter controls, listing-currency prices and matching route/card skeletons.
  Removed header collapse/search resizing, decorative particles and unnecessary
  per-scroll React updates. Existing results remain visible during filter changes;
  cancellation, 15s timeout, explicit retry/load-more prevent stale results and
  skipped pages. Hidden/unavailable listings no longer appear in public facets.
- All four desktop filter docks reserve space; mobile sheet scrolling/focus and
  saved-dock hydration verified. Final local build/TypeScript, touched lint,
  **21/21** units and **11/11** focused browser checks pass (56.6s), including eight
  viewport sizes, real wheel gestures, Pulse/footer and demo product/cart flow.
- Release `e11500c` / `dpl_4DAXWppTxnFvTWPwh1so2XPYYYW3` is READY at
  www.veggat.com. The final live browser batch is **12/12** (1.3m), adding direct
  catalog cart/buy-now checkout navigation and transport-failure recovery. That
  added case also passed locally **2/2** with setup (10.9s). No fulfillment,
  payment or additional AI credit grant occurred. Phone/light/landscape/wide
  screenshots inspected; live 1280px canvas centered at x=640 on 2560px, filter
  body scrolls to 512px while the underlying page remains at 0; no JS exceptions.
- Owner Chrome is still not exposed by the
  connector; physical-device/125% zoom, payment credentials, owner OAuth consent,
  Railway and the remaining route controls are not marked complete by this slice.

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

## S7 — Shared session first paint (local/live verified; speed work remains)

- Root SSR initializes the existing SessionProvider from verified Auth.js state.
  Demo banner/Pulse composer no longer appear after scrolling begins. The page
  minimum height uses actual remaining shell space; footer placement no longer
  depends on post-mount banner measurements. Personalized HTML is private/no-store;
  public routes stay public and API/action authorization remains unchanged.
- First local candidate **9/14** exposed a signed-in voice-control hydration
  mismatch. Fixed capability detection through the existing readiness hook.
  New hydration regressions plus auth/scroll units **33/33**, touched lint,
  production build/TypeScript pass. Corrected browser regression **20/20** (1.5m)
  and real recovery/2FA/OAuth-origin regression **3/3** (14s) pass locally.
- Explicit tradeoff: warmed local demo HTML now 56–62ms on Products/Pulse/cart,
  versus old guest-only cached 6–10ms; the initial client session fetch and late
  identity reflow are removed. Not a field-speed or zero-CLS claim. Full audit,
  live verification and owner-only prerequisites remain incomplete.
- Initial release `4d3769b` / `dpl_6c587YbafuzPL5rL28DqidJX76Mm` is READY.
  First live batch **19/20**: session/Pulse checks passed; Settings accepted an
  early click before hydration. Navigation/demo-exit now stay disabled until
  their handlers attach. Both new slow-script cases failed on the old build,
  then pass with the fix; local combined follow-up **22/22** and repeated
  auth/scroll/voice units **33/33** pass. Live follow-up is recorded below.
- First post-deploy live Pulse FCP was 5.38s; subsequent full-HTML requests were
  817/285/261ms. Cold-start/server bundle work remains a real speed finding,
  not hidden by local warm timings. Actual deployment runtime is arn1.
- Final app release `1c4de5c` / `dpl_98ErvyrqpWrqcPRRfjmvXTgdDzBD` is READY at
  www.veggat.com. Final combined live browser **24/24** (2.4m) passes, including
  real account recovery/2FA, private-session caching, both held-script cases,
  eight-size scrolling, Settings/AI/Messages/profile and marketplace flow.
  The preceding **21/22** run hit a transient duplicate DOM locator in a streamed
  auth page; the audit now requires one visible scroller and scopes its geometry
  there. Exact dimensions/scroll assertions and browser-error checks remain.
  Local/live frontend health and anonymous local backend health are 200.
  Corrected auth-layout local repetitions **3/3** pass (32.4s including setup).

## S7 — Product details and checkout polish (local/live verified)

- Product pages now use semantic light/dark surfaces and the listing currency as
  the primary price. Credit-pack delivery explicitly targets the AI balance, not
  My downloads. Checkout preserves separate 29/39 NOK lines and a 0 NOK demo total.
- Shared Add/Buy pending lock covers desktop and mobile actions. Buy reuses an
  existing cart line; digital Add does not duplicate it. Failed/uncertain cart
  reads or writes require reviewing the cart, not a blind retry. Server pricing,
  verified capture, limits and fulfillment are unchanged.
- Removed unused text-reveal helpers and delayed essential sections. Gallery
  image sizes respect the 1280px canvas. Product fetches abort after 15 seconds;
  Retry refreshes only product data. Skeleton gallery geometry is retained and
  reduced-motion skeletons do not pulse. No measured speed gain is claimed yet.
- PDP owns a bottom-only footer inside its actual product scroller, clear of the
  mobile purchase bar. Footer links now have 44px targets and short transitions.
- Real landscape Report click exposed an off-screen dialog (y=-74, bottom=464
  in a 390px-high viewport). Candidate constrains it to dvh with internal scroll,
  sticky actions, 44px close/reason targets and visible selection semantics.
- First focused local pass 7/8: the new test incorrectly expected a global footer
  on a product route and initially targeted the outer shell scroller. Corrected
  to the actual product scroller, added the missing PDP footer, and tested the
  real `veggat:theme` setting. Revised local **11/11** passes, including real wheel
  and independent drawer scrolling at eight sizes, two themes and Pulse recovery.
  Payment-safety units **39/39**, touched lint and candidate webpack/TypeScript
  pass. Final webpack/TypeScript and lint pass; final local browser **13/13**
  (1.2m), plus guest safe-login return path **2/2** (including setup), pass.
  Report dialog now sits at y=16..374 in a 390px-high landscape viewport;
  selection, typing and cancellation work without submitting any report.
  Release `c9ecf99` / `dpl_7iSv45jaVvxzcxEV8PWgcj6UQw52` is READY at
  www.veggat.com. Live focused browser **14/14** (1.7m) passes, including the
  guest return path, landscape report/cancel, error/concurrency fixtures,
  actual demo marketplace/cart, both themes, eight sizes and Pulse pagination.
  Local/live health are 200. No payment, report or additional credit grant was
  submitted. Other dialogs, shared-header alignment, cold starts and physical
  keyboard/125% browser zoom remain unfinished; no full-app completion claim.

| Area | Feature | Status / evidence |
| --- | --- | --- |
| Auth | Email login, session | DONE — current local/live browser round trips, revoked sessions rejected |
| Auth | Register, reset/verify, logout | DONE — current local/live UI round trips and token replay protection; human inbox delivery not independently confirmed |
| Auth | Google | PARTIAL — owner completed normal Chrome locally; automated browser blocked by Google |
| Auth | GitHub, Discord | PARTIAL — initiation checked, full consent/callback pending |
| Shop | List, PDP, images | DONE — both reviewer products and actual images verified locally/live |
| Shop | Cart | DONE — two lines, reload, quantity/removal, stable ordering and badge synchronization locally/live |
| Shop | Checkout | PARTIAL — local/Preview custom-credit demo, quote editing and retries pass; production promotion awaits payment acceptance |
| Shop | Live PayPal, sandbox PayPal | PARTIAL — both Sandbox SKUs captured; Live keys/webhook configured. Custom Sandbox webhook/refund tests need the owner's Developer sign-in; Live micro-purchase remains unverified |
| Shop | Confirmation, signed download | PARTIAL — local/live demo and actual Sandbox JPG/TXT downloads verified; anonymous 401 and replay pass. Live paid download still pending |
| Shop | Cheap JPG+TXT product, credits SKU | PARTIAL — 29/39 NOK Sandbox purchases verified. Custom 100–1,000 credits verified local/Preview in demo, not paid capture yet |
| AI | Chat, selector, streaming | DONE for tested OpenAI Luna/Groq demo and Sandbox-funded OpenAI Luna/Astra/Grok paths; other unconfigured models remain disabled |
| AI | Credit debit, zero balance, no overcharge | PARTIAL — demo debit/402, actual Sandbox 100→98→90→30 and insufficient-balance denial verified; atomic ledger/fuse tests pass. Provider-project hard caps/alerts and Live funding still require acceptance; no absolute overcharge guarantee |
| Wallets | Connect UI, no crash | PARTIAL — injected-wallet cancel/connect/disconnect passes local/live; configured WalletConnect open/escape and configuration units pass; owner-wallet verification pending |
| Platform | Public homepage | DONE — S1 verified locally and live |
| Platform | Consent controls Analytics/Speed Insights | DONE — no scripts before consent/Essential Only; both 200 after opt-in; real visitor metrics pending |
| Platform | Health | PARTIAL — local Hapi `/v1/health` 200 and mock shipping returns two NOK options; Railway auth expired and live backend unverified |
| Quality | Touched-file lint | PARTIAL — run after each slice |
| Quality | Home → demo → product → cart E2E | DONE — local and live pass; payment coverage remains a separate S4 task |
| Quality | Payment mocked in CI | BLOCKED — workflow implemented and local demo/retry/replay passes; GitHub rejects execution due to account billing lock. Provider transport mocked in unit tests |
| Layout | Core path at 360 and 2560, other requested sizes, 125% zoom | PARTIAL — core route/drawer/scroll tests include 360/390/landscape/768/1024/1280/1920/2560; all-route interaction, real phone keyboard and actual Chrome 125% zoom remain unverified |
| Interview | Root README | PARTIAL — human product story, demo, architecture, decisions, current payment status and CI scope documented; recording and Live payment evidence remain pending |

## S7 — Shared navigation alignment (local/live verified)

- One bounded header canvas, unchanged by scrolling; persistent independently
  scrolling desktop rail and existing mobile drawer share route definitions.
  Dashboard's overlapping legacy dock is no longer mounted. Role-appropriate
  admin/business/sales/trading destinations are preserved; authorization is
  unchanged. Auth and wallet providers stay mounted.
- Quick settings use visible 44px touch/keyboard controls instead of hover-only
  flip cards. Links preserve client navigation. Removed blanket storage/cookie
  deletion shortcuts; dedicated privacy/notification settings remain available.
- Controlled slow wallet-bundle test reproduced a 150px drawer-height jump,
  then passed after reserving the panel's geometry. Intermediate local batch
  **24/24** passed. Final candidate adds Dashboard single-rail hit-testing,
  light/dark layout, footer scrolling and eight-size coverage.
- Read-only follow-up triage: 28 route/viewport checks, no browser exceptions or
  failed same-origin requests. Notifications has mobile overflow and two
  unnamed controls; its dead Filter/Load more actions and error handling need
  the next scoped audit. Profile's initial loading capture is not a feature pass.
- Final candidate: webpack/TypeScript, touched-file lint and local focused
  browser **25/25** pass (2.6m). Not a whole-app or measured CWV completion claim.
- Navigation release `364d8f5` is live. First live batch **24/25**; the delayed
  wallet fixture also blocked unrelated drawer infrastructure. Isolating only
  the wallet-panel bundle gives **2/2** live passes with identical assertions.
- Live visual QA exposed a separate whole-app loading regression: delayed
  provider code could replace readable server content with AppBootSkeleton.
  A controlled local delay reproduced the disappearance. AppShell and wallet
  providers now use stable static boundaries; optional wallet UI stays lazy.
  Tradeoff: the gate no longer has a separate lightweight JS dependency graph.
  Follow-up build/TypeScript, lint and local browser **27/27** pass (2.3m).
  Release `503c059` / `dpl_AHQhfw58y7yziP19fgfhhsv4LkDM` is READY at
  www.veggat.com. Expanded live browser **30/30** passes (3.3m); supplementary
  local pre-JS auth/early-scroll/anonymous AI selector **4/4** passes. Fresh live
  Dashboard startup/resize and actual mobile Pulse scrolling were visually
  checked. Local/live frontend health are 200. Remaining work includes
  Notifications, profile loading and demo order amount labeling; all-route
  feature completion, physical mobile/Chrome zoom and field CWV remain open.

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
- Current local production-style test process uses the isolated Neon Preview database through the guarded Sandbox launcher. No Live PayPal keys are added to localhost. Earlier live-database test observations above are historical, not the current routing.
- Real Chrome is connected and has been used for Sandbox checkout, credit-funded chat and the custom-credit/currency checks. Browser-blocked OAuth is not bypassed; owner consent still needs completion. Do not spoof Google's browser checks or telemetry automation exclusions.
- Demo creates a separate temporary USER per visitor, bounded to five per daily IP fingerprint and 200 globally/day in a serialized transaction; sessions expire after a day. The S5 candidate permits guarded private chat creation/messages and five one-time credits. Cart/demo-checkout remain isolated; real payments, public posting and provider-key changes remain denied.
- New paid entitlements must never be granted from client prices or a return URL. S4/S5 remain release blockers.
- Sandbox PayPal credentials are configured locally/Preview; Live credentials and webhook are Production-only. Both fixed Sandbox SKUs were purchased using test money. No Live charge has been made. The current Developer sign-in/passkey handoff blocks retrieving the Sandbox buyer, not API-key configuration.
- Railway CLI is installed but `railway list --json` returns Unauthorized; the
  showcase worktree has no linked Railway project. Backend health/deployment
  cannot yet be verified. The earlier Chrome connection failure is resolved;
  Railway authorization/deployment still needs a fresh check.
- Payment implementation references: [PayPal environment separation](https://developer.paypal.com/api/make-api-requests), [Orders v2](https://developer.paypal.com/api/orders/v2), [idempotency](https://developer.paypal.com/api/rest/reference/idempotency/). Unsafe legacy capture/grant handlers now fail closed; webhook development bypass removed. Production webhook target is `/api/webhooks/paypal`.
