# Veggat production scoreboard

Evidence is recorded per slice; a passing HTTP response is not proof of feature completion.

## Message reading and composer layout — 26 September 2026

**PARTIAL — local acceptance complete; hosted promotion pending.** Incoming
replies preserve reading position, the latest-message control remains reachable,
and the composer fits the actual shell height including demo banners. Semantic
bubbles, accessible 44px actions and reduced-motion behavior replace inconsistent
styling. Strict build/TypeScript and 41 scoped local browser checks pass, including
phone landscape, light/dark and ultrawide. No API/payment/credit/schema changes.
See [reproductions and evidence](message-reading-evidence-2026-09.md).

## Messages writes and private realtime — 26 September 2026

**DONE for scoped message writes/private realtime; wider messaging remains PARTIAL.**
Runtime `576b5ce` (test-only follow-up `21916cc`) is Live as
`dpl_EuM4C5woTVkV4h7Z7VhjwsofbWVB`. Current-session
write authorization, atomic retry/counters, cross-thread reply checks, private
Pusher authorization and body-free message invalidations are implemented. 90
unit/API tests, strict build/TypeScript, error-free touched-file lint (two existing
Pulse warnings), 45 browser regressions each locally/Preview/Live, hosted channel
authorization/denial checks and a real two-user isolated-DB send/edit/delete/
revocation test pass. Real Chrome verifies the existing Live thread and members
sheet. Hosted mutation tests are fixtures, not actual customer writes.
New private human-chat image uploads are
disabled pending private storage; AI-chat images are unaffected. Historical human
attachments and remaining conversation/reaction mutations still need review.
No schema/payment/credit changes. See [scope and evidence](messages-security-evidence-2026-09.md).

## Header Messages preview — 26 September 2026

**DONE for the scoped header menu and skeleton release; full messaging remains PARTIAL.**
Runtime `6190eb4` is Live as `dpl_BtXbs2dMQRqg1YS7xRrrvj5GkeqP`. The preview
works on phones, uses real participant/latest-message fields, keeps account
responses isolated and offers working search, retry, close and New chat links.
Skeleton geometry matches loaded rows. A Live early-click failure was reproduced
and fixed by disabling the trigger until hydration. Strict build/TypeScript/lint,
31 unit/API tests, 39 local, 33 Preview and 39 Live scoped browser checks pass.
Real Chrome verifies the populated final Live menu and navigation. Payments,
credit balances, prices and schema are unchanged. Next: message-send and realtime
privacy/security, then the remaining route interactions. Physical phone keyboards
and actual 125% browser zoom remain coverage gaps.
See [scope, failures and final evidence](messages-preview-evidence-2026-09.md).

## Messages inbox — 26 September 2026

**DONE for the scoped inbox release; full messaging and route audit remain PARTIAL.**
Runtime `a93beac` is Live as `dpl_GQjxL8XhGKiR2pJYXcjLmfxB59ZA`. A missing profile
filter no longer falls through to an unrestricted conversation query. Private
previews show the latest reply. Named 44px actions, keyboard links, clear search,
paging/retry and honest deletion feedback replace broken/hover-only controls.
17 API tests, strict build/TypeScript/lint and 33 scoped browser checks pass
locally, on Preview and Live (Preview terms checked against its own source).
Real Chrome verifies the populated Live inbox, sorting and cancelled deletion.
No customer conversations, payments or schema were changed. Full messaging
delivery/security and the route audit remain open. See [evidence](messages-inbox-evidence-2026-09.md).

## Private chat images — 26 September 2026

**DONE for the scoped private-chat-image release; wider hardening remains PARTIAL.**
Production-safe runtime `e146a51` is Live as `dpl_8HzKaddUEbAKMPfcznPBQ3gYvmQQ`.
Per-chat image/model drafts,
private attachment storage, server-side image normalization, reviewed vision costs,
bounded streams and cleanup are implemented. Build/TypeScript/lint, 75 units and
24 local, 18 Preview and 18 Live browser checks pass without retries/skips.
One real local image reply debited 3 isolated QA credits;
zero-balance and unauthorized/private-storage checks passed. Only two private-image
migrations were promoted; pending payment/schema changes were excluded. No Live
generation or QA grants were made. Actual paid vision inference remains local evidence.
Real Chrome text drafts pass; automated file selection needs extension file-URL
permission. Live real Chrome model selection and zero-credit blocking pass.
Read-egress limits, unavailable-default-model UX, homepage attachments and durable
drafts remain follow-ups. [Scope and evidence](ai-chat-images-evidence-2026-09.md).

## AI canvas and independent drafts — 26 September 2026

**DONE for the scoped text-chat canvas; attachments/full-route readiness remain
PARTIAL.** Runtime `85dc830` is Live as `dpl_3BvBmVYkht32cq525oEy9XHdWbWx`.
Centered new chat, private per-conversation text drafts, accessible reordering,
safe Markdown and compact landscape composition pass build/TypeScript/lint,
55 focused unit tests and 25 browser checks each locally and Live. Real Chrome
confirms the clean canvas, mobile drawer and unsent draft navigation. Payments,
ledger, prices and schema are unchanged. See [evidence](ai-canvas-evidence-2026-09.md).

## Current integrated production release — 25 September 2026

Company checkout reporting: **DONE for verified order counts and balanced
detail-page layout; full financial accounting and the full-route audit remain
PARTIAL**. Runtime `13abe73` is promoted as
`dpl_9GBCFq6iLZiKCL6fTYG2pdMB49BU`. A bounded, same-snapshot aggregate replaces
the misleading legacy Sales count, with separate Live paid, adjusted, review
and Sandbox groups. These follow currently linked products, not historical
seller attribution or revenue. 47 focused tests, nine isolated PostgreSQL
checks, 132 combined regression tests, touched lint, TypeScript and strict builds
pass. Local/Preview/Live each pass light **2/2** and dark **2/2**, with no skips
or retries. Real Chrome confirms two Live paid orders and two Sandbox captures,
the full collapsed summary at 1280x800, and phone scrolling to the footer. No
captured console errors; viewport restored. No Live company fields, payments
or emails were changed. Next: actual 125% browser zoom (manual Chrome-menu
action requested) and the remaining route interactions. See
[company checkout reporting evidence](company-checkout-reporting-evidence-2026-09.md).

Company administration: **DONE for working detail/edit routes, audited
storefront edits and responsive recovery; company sales metrics and wider
admin/full-route audit remain PARTIAL**. Runtime `ed81eb2` is promoted as
`dpl_CrRSMTTVxb1cRW5XYSAaE1KypDFA`. List search/sort/pagination, real View/Edit
destinations, strict current-role/version checks, same-origin bounded patches,
conflict-safe transactional edits/audits and private access-loss recovery replace
the broken flow. Cascading deletion is refused. 45 focused tests, four isolated
PostgreSQL checks, 130 combined regression tests, touched lint and strict builds
pass. Local/Preview/Live each pass light **2/2** and dark **2/2**, with zero
retries/skips. Actual local HTTP/UI saves use disposable isolated records;
hosted edit cases use browser fixtures. Real signed-in Chrome confirms list,
details, editor disclosures, 390/1280 layouts and page/sidebar scrolling; its
viewport is restored. No company fields, payments or emails were changed in
production; normal detail views added VIEW audits. The design-guidelines review
informed labels, 44px controls, token surfaces and concise disclosures. Next:
reconcile the legacy Sales count with verified marketplace orders. See
[company administration evidence](admin-company-evidence-2026-09.md).

Owner audit log: **DONE for private read access, filters, recovery and responsive
details; wider admin/full-route audit remains PARTIAL**. Runtime `69b21de` is
live as `dpl_Br5VH55HrqRSyHHqkVfYF2uxbSbW`. Invalid empty select options no
longer crash the route. Validated, rate-limited, private/no-store reads return
compact summaries; bounded credential-redacted details load on demand. Access
loss removes private data, and failed retry cannot restore it. 64 focused tests,
touched lint, strict local/remote builds and actual isolated local HTTP/UI
acceptance pass. Local/Preview/Live each pass light **2/2** and dark **2/2**,
zero retries/skips. Real Chrome confirms the signed-in owner's filtered entries,
phone detail/focus recovery, footer scrolling and normal desktop layout; its
viewport is restored. No customer records, payments or emails were changed.
The design-guidelines review informed labels, touch targets, token surfaces and
overflow handling. Next: company-admin View/Edit dead links. See
[audit-log evidence](audit-log-evidence-2026-09.md).

Preview Sign Out: **DONE for durable preview revocation and honest retry;
wider account audit remains PARTIAL**. Runtime `6f8de52` is live as
`dpl_9apZWJjqFi3qeZ8PsDVHCSH1JDLv`. Auth.js-validated sign-out atomically ends
the exact preview grant with its audit. A failed transaction preserves the
cookie and visible retry controls instead of reporting success. Normal
non-preview JWT logout semantics are unchanged. 181 focused tests, nine
isolated PostgreSQL checks, actual local HTTP/UI copied-cookie acceptance,
touched lint and strict local/remote builds pass. Local/Preview/Live each pass
**4/4 in both themes**, zero skips/retries. Real Chrome remains signed in after
the release; no customer was previewed, changed, charged or signed out.
No migration was needed. See
[preview sign-out evidence](preview-signout-evidence-2026-09.md).

End Preview revocation: **DONE for the scoped replay gap; wider session audit
remains PARTIAL**. Runtime `bd0b5ad` is live as
`dpl_fb63nooZX4SXo5c4EMVeK4cLewZt`. A durable, version/deadline-bound grant is
checked on every preview validation and atomically ended with its audit before
owner restoration. Copied cookies cannot authenticate or restore the owner after
End; concurrent End requests have one winner. 161 focused tests, six isolated
PostgreSQL checks, actual local UI/HTTP replay tests and strict builds pass.
Local/Preview/Live each pass **3/3 in both themes**, without skips or retries.
Real Chrome local/Live sessions remain usable; no customer was previewed or
edited. The preview Sign Out gap is closed by the follow-up above; normal JWT
logout behavior, broader read-handler review, role-management step-up and
retention-safe erasure remain separate work. See
[preview revocation evidence](account-preview-revocation-evidence-2026-09.md).

Account administration: **DONE for scoped audited edits and responsive recovery;
wider account management remains PARTIAL**. Runtime `f4e1343` is promoted as
`dpl_J7GwrYcX1EG2GcZPrPByyRewQFJb`; production health and strict builds pass.
Strict field policy, current-role/version
checks, optimistic concurrency and transactional audits replace the unsafe
privileged update. USER/ADMIN role changes revoke existing target sessions;
email and verification cannot be fabricated. Cascading deletion is refused, not
reported as completed erasure. The responsive editor preserves drafts and handles
conflicts explicitly. 85 units, four isolated PostgreSQL checks, actual local
HTTP/UI acceptance and local/Preview/Live light/dark browser **2/2 each** pass.
Real Chrome used the owner's signed-in session to inspect their read-only record
at 390/1280/2560, scroll to the phone footer, and scroll the desktop sidebar
independently. No Live profile or role was changed. Remote edit cases use browser
fixtures; real writes use disposable isolated local principals. Hosted upload,
role-management step-up, ownership transfer and retention-safe erasure remain
unfinished. See [admin detail evidence](admin-user-detail-evidence-2026-09.md).

Account preview: **DONE for scoped session/perimeter safeguards and local
synthetic-principal UI acceptance; wider account management remains PARTIAL**.
Runtime `9624ca1` is promoted as `dpl_6EdfXa99sJMRZyL2FDbmN1uhji5X`.
Owner-only previews require current owner/target versions, an absolute one-hour
deadline and mandatory transactional audit; failures cannot become an ordinary
member session. Writes, identity linking and known side-effectful GET paths are
blocked. The banner no longer covers navigation and has keyboard/retry/sign-out
recovery. 98 units, three isolated PostgreSQL checks, local actual HTTP/UI
start/end and revocation checks, touched lint and strict local/remote builds pass.
Local, Preview and Live each pass **3/3 in both themes**, eight responsive sizes,
zero skips/retries. Real Chrome preserves existing signed-in local/Live settings.
The retained-demo marketplace regression also passes **1/1 locally, on Preview
and on Live** (custom credits, cart, unpaid receipt, access denial and replay).
Its stale expanded-terms locator was repaired; a fresh local rerun hit the real
signup cap, which remains unchanged. CI defaults still use fresh sign-in.
No customer was impersonated or charged; disposable test principals/audits were
removed. Per-preview server-side revocation and scoped privileged user-detail
mutations were completed by the follow-ups above; broader read-handler audit
remains unfinished. See
[account preview evidence](account-preview-evidence-2026-09.md).

Personal account settings: **DONE for deployed validation, scoped service tests
and UI recovery; full account management remains PARTIAL**. Runtime `a4d40fd`
is promoted as `dpl_9Nm3dqkYF7okt1jCkSNqJL5RgNT9`. Strict allowlisted writes,
current-password/action-bound email confirmation, atomic version increment and
proof revocation replace the unsafe settings update. An unused unauthenticated
hard-delete Server Action is removed; account-owned deletion requests are
serialized and cancellable only while pending. Profile and Security save
separately, keep drafts across session refresh, and use bounded touch-sized forms
with a sticky action. 69 focused units, three isolated PostgreSQL checks, touched
lint and local/remote strict builds pass. Final local light/dark, Preview and
Live light/dark browser runs each pass **1/1**, eight sizes, no configured retries
or skips; the initial cold-start null-demo-session failure is recorded, not hidden.
Real Chrome confirms local/Live phone scrolling and unchanged account settings.
Verified email replacement, actual security-email/credential-change acceptance,
retention-safe erasure and privileged user-detail writes remain unfinished.
Impersonation version/deadline revocation is covered by the later slice above.
See [account settings evidence](account-settings-evidence-2026-09.md).

Admin directory: **DONE for deployed list/read fixes and scoped automated checks;
real-Chrome privileged-session acceptance and wider account management remain
PARTIAL**. Runtime `02a0771` is promoted as
`dpl_ANzfTB8VgGnV61MXiqbVeZGYUo4H`. Strict query bounds, stable ordering,
private/no-store responses, demo denial and truthful bulk-write refusal are
covered. Labelled touch-sized filters replace the broken role picker; debounced
search handles rapid changes without late URL navigations overwriting drafts.
Dead Edit/Delete actions were removed, not simulated. 60 focused units,
touched lint, strict local/remote builds and local/Preview/Live browser **2/2**
each pass without retries/skips; local dark mode **2/2** also passes. Eight
viewport sizes include 360 and 2560px. Real Chrome requires the existing admin
gate password; no real member, role, payment or email changed. Legacy `/api/users`
and privileged user-detail mutations remain the next audit targets. See
[admin directory evidence](admin-directory-evidence-2026-09.md).

People discovery: **DONE for scoped endpoint privacy/mobile placement;
desktop paint acceptance remains PARTIAL**. Runtime `60e99a9` is promoted as
`dpl_5ZcQot1hG9J4bGZMX7WE8brdiggo`. Exact lookup filters email visibility in the
query; bounded suggestions and account-safe search/follow feedback replace the
hover-only panel. 72 focused units, 11 isolated PostgreSQL checks, strict builds,
and populated local/Preview/Live browser **3/3** each pass without retries/skips.
Real Chrome confirms phone placement but still captures blank card interiors
after independent sidebar scrolling. No real follow/payment write was submitted.
See [people discovery evidence](people-discovery-evidence-2026-09.md).

Source publication: **PARTIAL**. The runtime release was 79 commits ahead of its
remote at this audit, with no open release PR. That unpublished range passes a redacted secret
scan; the historical repository scan requires separate owner-approved remediation.
No force push, history rewrite, repository visibility change or credential use
was performed. GitHub's isolated E2E job remains blocked by an account billing lock.

People-search privacy: **DONE for this endpoint; the wider directory/social
audit remains PARTIAL**. Runtime `026504e` is promoted as
`dpl_HL9N6CcyyuZimaX1K4XY6rW4iPhF`. Demo searches return no real people, all
responses are private/no-store, ordinary users do not receive platform roles or
hidden emails, literal search is bounded and throttled. Independent follow
queries run together; empty searches avoid them. 29 search unit/database checks,
58 combined regression units, strict builds, touched lint and local/Preview/Live
browser **4/4** each pass, zero retries/skips. Real Chrome positive/empty searches
pass locally/live without sending messages. Existing QA/system directory entries
need a separate evidence-based cleanup; no accounts were deleted. See
[people-search evidence](people-search-evidence-2026-09.md).

Company-team authorization and forms: **DONE for this scoped slice; full S8
remains PARTIAL**. Runtime `73fbabe` is promoted as
`dpl_GzBe9UhaKx73rXiVEFYBTGqMTPkp`. Both Server Actions and four mutation routes
now check current actor/company authority and reviewed member versions. Owner/self
protection, lower-role delegation, partial permission updates and serialized
concurrent writes are covered. 48 focused unit/database checks, strict builds
and local/Preview/Live browser **6/6** each pass; dark-mode follow-ups pass.
Final runs have no retries/skips. Real Chrome confirms unchanged owner settings,
bounded search, responsive team forms and page/footer/drawer scrolling. No real
membership, payout or payment changed. The initial Live focus-race test failure
and synchronization correction are recorded in
[company-team evidence](company-team-evidence-2026-09.md).

Personal payment loading: **DONE for this scoped slice; full S6 remains PARTIAL**.
Runtime `0a9372f` is promoted as `dpl_3BBG14nUjk62GL6WksePop6uQ1Tv`. One
owner-checked snapshot replaces the separate EVM-only request; eligible families,
Web3-off state, bounded loading/retry and unsaved email drafts are handled together.
Five failures reproduced before the fix; final **86/86** focused units, strict
builds, touched lint and local/Preview/Live browser **5/5** each pass with no
retries/skips. Real Chrome verifies unchanged owner payout details and phone
scrolling/layout. No email or wallet change submitted. See
[personal payment evidence](personal-payment-read-evidence-2026-09.md).

Company receiving wallets: **DONE for the scoped implementation/deployment;
genuine extension/crypto-payment acceptance remains PARTIAL**. Runtime `e5feb4c`
is promoted as `dpl_4R6K4gm5vduADBLBH8tx4uJgETrC`. Verified company and current-owner
personal choices are returned by an owner-checked read; stale personal/company
setters fail before issuing approval or writing a destination. Web3-off states,
bounded loading, retry and unsaved email drafts are covered. 76 focused units,
110 isolated PostgreSQL checks, strict builds and local/Preview/Live Playwright
5/5 each pass, zero retries/skips. Real Chrome shows the retained live owner's
two eligible personal wallets without selecting either; phone/footer and
landscape drawer scrolling pass. No real email, wallet or payment changed.
See [company wallet evidence](company-wallet-evidence-2026-09.md).

Company PayPal settings: **DONE for the scoped implementation/deployment; real
inbox-confirmation acceptance remains PARTIAL**. Runtime `2b1c540` is promoted as
`dpl_D3pZ51WDfYmCamiWW2e8QNKjPic3`.
The permanent company ID is accepted; pending email changes preserve the current
address and use owner/site-bound, atomic one-use verification with explicit approval.
Company settings is payment-first and responsive. Strict builds, 74 focused tests,
16 isolated PostgreSQL tests and final local/Preview/Live Playwright 4/4 each pass
without retries/skips. Real Chrome confirms live owner access, phone fit, page/footer
and drawer scrolling. The failed Preview currency prerender is fixed with a request-time
boundary; provider caches remain. Health/currency checks pass. No real receiving
details or emails were changed. See
[company PayPal evidence](company-paypal-evidence-2026-09.md).

Company read boundaries: **DONE for this scoped slice — deployed as `cc31221`,
`dpl_C4eiasxJTxHeGd63WqtrLPY1WyCj`**. Four internal endpoints enforce current company membership and
current privileged role, with private/no-store responses and safe recovery UI.
The public storefront routing regression is corrected without opening management
pages. 48 focused units, 37 rolled-back PostgreSQL checks, strict builds and local
2/2, Preview 2/2, Live 2/2 browser checks pass (no retries/skips). Real Chrome
confirms non-member denial and retained live owner access; Live health passes.
The subsequent company PayPal release above resolves the permanent 26-character
company ID rejection, atomic email-verification gap and oversized settings layout.
Genuine inbox confirmation remains separate; company personal-wallet choices
are now covered by the receiving-wallet release above.
See [company access evidence](company-access-evidence-2026-09.md).

Combined wallet release: **DONE for deployment and scoped acceptance; S6 remains
PARTIAL**. Source `07cabde` is READY and promoted as
`dpl_DbYF6shZVj6jzstPgrbB7Z4XHcLg`. Isolated Preview **16/16** (including actual
disposable EOA login, HTTPS cookie binding, logout/replay), Live **14/14**, strict
builds and candidate/Live health pass. No retries/skips. Real Chrome preserves
both owner wallet links and receiving choice; phone/landscape confirmation,
Cancel/focus, page/footer and drawer scrolling checked without submitting changes.
Real extension, company-page and crypto-payment acceptance remain separate.
See [combined release evidence](wallet-combined-release-2026-09.md).

Web3 mode: **PARTIAL — deployed; scoped checks pass**. One guarded
API now requires explicit confirmation, fresh account state, a remaining sign-in
method when disabling, scoped one-use 2FA and atomic writes. Obsolete email links
are read-only; neutral loading replaces the false-off flash. Server preference
overrides stale browser opt-ins. **266 focused checks (89 isolated PostgreSQL)**,
strict build, touched lint and final local browser **14/14 (31.9s, no retries/skips)**
pass. Eight screen sizes plus real Chrome desktop/phone/landscape, page/drawer
scrolling and Cancel/focus checked. No owner mode, wallet, payout, email or payment
changed. Combined Preview/live acceptance is recorded above.
See [Web3 mode evidence](web3-mode-evidence-2026-09.md).

Wallet sign-in: **PARTIAL — deployed; real extension acceptance pending**. Browser/host-
bound one-use EOA proof, verified personal-wallet identity resolution, atomic
signup/2FA, shared address locks and last-wallet recovery checks replace the old
address-only path. **214 focused checks (73 isolated PostgreSQL)** pass. Local
real-signature sign-in/logout/replay and responsive code-form acceptance passed
in a **12/12** focused browser run; final compact-UI follow-up recorded in
[wallet sign-in evidence](wallet-login-evidence-2026-09.md). Real Chrome retained
the signed-in owner session with no wallet changes. Web3 enable/disable alignment
is now verified and deployed (above); genuine extension acceptance remains.

Receiving-wallet settings: **PARTIAL — deployed; genuine extension acceptance pending**.
Personal/company setters now share ownership locks, host/action/current-choice
codes, atomic destination writes and explicit clear confirmation. Wallet list and
seller defaults stay consistent across families; company choices cannot alter a
personal default. Shared form handles cancellation, errors and uncertain outcomes.
Final **138 focused checks (49 isolated PostgreSQL)**, strict build, touched lint
and local browser **10/10 (20.3s, no retries/skips)** pass. Eight screen sizes and
real Chrome page/drawer/sidebar scrolling checked. No real payout/email/payment
changes. Wallet login alignment and combined deployment now pass (above); company
page browser acceptance is covered by the newer company-wallet release above.
See [receiving-choice evidence](payout-choice-evidence-2026-09.md).

Wallet mutations: **PARTIAL — deployed; real extension acceptance pending**. Strict
action parsing, action/host/wallet-scoped one-use codes, transactional receiving
choices, reference-safe removal and manual-create default isolation are added.
88 focused checks (36 isolated PostgreSQL), strict build, touched lint and final
local browser **9/9 (18.6s, no retries/skips)** pass. Real Chrome local phone
scrolling and targeted responsive screenshots were inspected.
The parallel seller-payment actions are now aligned and deployed (follow-up above);
the wallet-login flow is now aligned and deployed; full wallet acceptance remains.
No real wallet/payout changes were made.
See [wallet mutation evidence](wallet-mutation-evidence-2026-09.md).

Wallet-linking security: **DONE for the focused server-challenge slice;
real extension acceptance remains PARTIAL**.
Both verification UIs now require a server-issued account/host/chain-bound
challenge; purpose-scoped email codes and challenge consumption are single-use.
Wallet writes and challenge consumption commit together. Direct client-generated
proofs are rejected; cancellation cannot submit a late wallet signature.
38 focused tests (including 16 isolated PostgreSQL cases), strict local build,
touched lint pass. Source `ec4d88f` is READY and promoted as
`dpl_H9pKHzLJ46nCEouZ8S39uAZAjsgH`. Final browser **9/9 locally (20.7s)**
and **9/9 Live (25.8s)** pass, no retries/skips. The initial Live 8/9 result
identified a pre-hydration help click; the test now waits for the existing
hydration-ready shell, while that early-click UX issue remains open.
Real Chrome Refresh preserves both owner wallets and the receiving choice.
Positive browser flows use a dummy signer, not real extension acceptance.
No real wallet signature, email, payment or customer-data mutation occurred.
Wallet login, primary/rename/delete and real crypto acceptance remain separate.
See [wallet-link evidence](wallet-link-evidence-2026-09.md).

Wallet read/cache safety: **DONE for this focused local/Live slice**. Wallet listing
no longer assigns a primary/payout destination; the unused automatic metadata
writer is retired. Malformed browser cache entries no longer crash navigation,
and cached database IDs/proof are discarded. 50 units, one isolated PostgreSQL
concurrency check, strict build and touched lint pass. Focused local browser
**9/9** passes (17.9s, no retries/skips). Source `33cf187` is READY and promoted
as `dpl_FcLbY8X9CWFBrbqA7e9hE5MpwDc8`; Live **9/9** passes (39.4s,
no retries/skips). Real Chrome Refresh preserves both owner wallets and the
primary choice; candidate and Live health pass. No customer
wallet, payout destination, email or payment changed. Challenge/account-binding
and mutation security remain to audit; real crypto checkout is not accepted.
See [wallet read/cache evidence](wallet-read-cache-evidence-2026-09.md).

Wallet-display follow-up: **DONE for this focused local/Live slice**. Removed
email-based address/proof merging and automatic metadata POSTs during render.
Local development-chain probes are cancellable and retain their prior status.
Full touched-file lint now passes with no disabled rules, resolving the prior
wallet lint gap. 22 units, final strict build and focused local browser **5/5**
(14.2s) pass. The latter caught and fixed an 8px delayed-panel layout shift;
both 360/390px scroll checks now pass. Source `7101bd3` is promoted as
`dpl_91FYRUpZa1UD71DgMYxifXgYr1qE`; Live browser **5/5** passes (26.9s,
no retries/skips). Real Chrome confirms mobile drawer scrolling locally and
both saved verified owner wallets intact on Live. Real signing and production
crypto checkout remain separate, incomplete acceptance items. No wallet
signature, transfer, account permission, payment or secret changed. See
[wallet-display evidence](wallet-display-evidence-2026-09.md).

Verification-evidence follow-up: **PARTIAL — implementation and 68 focused
tests pass (55 units, 13 isolated PostgreSQL cases)**. Settings and Reach share
current provider/wallet/Live-capture evidence. Refresh is read-only; pending
donation claims cannot increase verified totals. The PostgreSQL race found and
fixed a Prisma raw-query retry gap. Final strict build and local browser **2/2**
pass (16.2s). Source `32fa4c5` is promoted as
`dpl_5fpyQNqjNq1PdN1Y2k84qZgaCkRb`; Live browser **2/2** passes (28.6s).
Real Chrome confirms 60 points / four current checks and working read-only
Refresh. Focused source/E2E lint passes, but full wallet lint is not green:
an isolated rules-of-hooks slowdown and pre-existing synchronous effect error
remain. No lint configuration was weakened. No email, purchase, refund or
credit grant occurred. Genuine email callback acceptance remains separate. See
[verification-evidence notes](verification-evidence-2026-09.md).

Account-verification follow-up: **PARTIAL, guarded link fix deployed**.
Truthful pending/expired badges, real resend action, scanner-safe confirmation,
atomic token use and last-login preservation are implemented. **55 units + 2
isolated PostgreSQL concurrency tests pass**; final local browser batch **3/3**
passes, including five widths in both themes. Final strict build and lint pass.
Source `b7b1b16` is live as `dpl_9pAddYnAJ6pKB1ncFTBSu6F7Sq8u`;
Live focused browser **3/3** passes (38.4s), health 200, scanner-safe redirect
303/no-store and cross-origin unlink 403. Real Chrome confirms the actual
Google/GitHub badge distinction. The stale saved Reach/checklist contradiction
was subsequently addressed by the current-evidence reader recorded above.
No real confirmation email or account unlink was performed. See
[account-link evidence](oauth-link-verification-2026-09.md).

Live Google and GitHub: **DONE for the existing-account login round trips**.
Real Chrome logout → provider button → signed-in app succeeds for both on
`38d22c9`; the restored GitHub session can still read the existing paid receipt.
Discord initiation reaches the correct Live callback/S256 consent screen;
new permission was not granted. Cancellation exposed missing login feedback.
The shared allowlisted error-message fix has 36 passing units, touched lint and
a passing strict build. Two local browser checks pass (9.9s): seven error codes,
390/1280 widths, both themes, rendered contrast >=4.5:1 and recovery navigation.
Production `399cb29` is READY and promoted as
`dpl_DXpBMhmCt4Rf5AP7acyCjCHJhGxE`. Four focused Live checks pass (34.3s,
no retries/skips): both auth themes, compact receipt and protected email job.
Real Chrome Discord cancellation now shows guidance; GitHub recovers the same
account and paid receipt. No new account link, payment,
refund or extra download was performed. See [OAuth evidence](oauth-feedback-2026-09.md).

Receipt delivery evidence: **PARTIAL — authenticated provider evidence obtained;
signed callback implementation deployed and scoped local/Preview/Live checks pass**. The real Resend dashboard
confirms receiving-server acceptance of the paid artwork's original receipt at
01:13:45 UTC, before the recorded JPG/TXT requests. This is not proof of a human
reading it or complete legal compliance. New signed callbacks preserve original
messages, serialize delivery/dispatch races and cannot grant/refund purchases.
59 units, four isolated Postgres cases and touched lint pass; the optional real
send test is deliberately skipped. Strict build/TypeScript and final local
receipt/job checks pass 2/2 (5.1s) after a normal free-demo fixture checkout.
Source `38d22c9` is READY on stable Preview as
`dpl_2zizhKfbCZjAUbJ2KN3LFeD1JtGG`; the same two checks pass (6.8s), plus
candidate health and missing-secret 503/no-store. Production
`dpl_27aKdwxTHmwGc8oExXKhASRNReoi` is READY and promoted to www.veggat.com.
Both environments have 53 additive migrations. Live receipt/job checks pass
2/2 (7.8s, no retries/skips), after preparing a missing receipt through normal
free-demo checkout; Live health and unconfigured-callback 503/no-store pass.
Real Chrome confirms the paid receipt is unchanged. Following explicit owner
confirmation, the five-event Resend webhook is enabled and its signing secret
is saved as a Vercel Secret for Production only. Runtime activation is verified
on `399cb29`: unsigned callbacks return 401 and oversized payloads 413, both
no-store. A subsequent genuine registration-bounce event and one replay both
return HTTP 200; its unrelated provider ID matches no transactional receipt.
Read-only production inspection confirms the paid receipt remains unchanged.
Matched receipt-delivery/replay acceptance remains pending. No paid purchase,
refund or customer email resend occurred. See [delivery evidence](email-delivery-events-2026-09.md).

First-download reminder: **local and Live acceptance DONE for this UI slice**.
Source `273c162`, Production `dpl_9wGrjccRuQiJCoN37rGFHMtHsjiv` is READY at
www.veggat.com. Three focused checks pass locally (25.7s) and Live (46.6s):
Cancel/Escape without a file request, accessible focus, retry, repeat download,
eight sizes in both themes, library states and actual free-demo checkout to
protected JPG download. Strict build/TypeScript, touched lint, 40 focused unit
cases and candidate/Live health pass. Real Chrome verifies the signed-in owner's
library without consuming more downloads. This informational reminder is not
a new waiver, retrospective consent or automatic refund restriction. No paid
purchase or refund occurred. Full legal evidence-chain review remains pending.
See [download reminder evidence](download-reminder-2026-09.md).

Pulse reading/navigation: **local and Live acceptance DONE for this slice**.
Source `7a85020`, Production `dpl_EmGgyr8xdfS2NNsTq2Gha7Zdsbrc` is READY at
www.veggat.com. Four focused checks pass locally (39.1s) and Live (43.1s),
covering eight sizes, history, focus, internal scrolling and tag state.
Strict build/TypeScript, touched lint and candidate/Live health pass.
Real Chrome opened an actual public post and checked its mobile header.
No payment, refund or public post was submitted. This does not prove all Pulse
permissions, publishing or moderation behavior. See [Pulse evidence](pulse-navigation-2026-09.md).

Homepage chat: **local and Live acceptance DONE for this layout fix**. The empty welcome
no longer auto-scrolls above its panel; expanded chat uses the shared accessible
dialog above the site header. Four focused tests pass at eight sizes in both
themes, including nested model selection, focus return and an intercepted streamed
reply. Strict build/TypeScript and touched lint pass. Real Chrome verifies normal
motion and the expanded layout. Source `f5fcf37`, Production
`dpl_DbWCX7nrZR7dYj8CkqGW1Wd5dM8x` is READY at www.veggat.com; the same four
focused checks pass Live (38.9s), with candidate and Live health healthy.
No paid generation or refund occurred.
See [chat layout evidence](landing-chat-layout-2026-09.md).

Interview walkthrough: **DONE for the published introduction and player**.
A 75.72-second real Live recording follows public home → isolated demo → artwork →
free checkout → actual protected JPG download → automatic credit quote → AI workspace.
The new demo order has no payment/capture. No PayPal or generation requests occurred.
The opt-in browser test passes locally and Live; no paid refund was submitted.
Source `d2f8c87`, Production `dpl_74FcTAtrnRkevSGjUtgERSb1HH6s` is READY at
www.veggat.com. Separate local/Live player checks each pass: keyboard playback,
nine captions, full decoding to the end, four responsive sizes, and no video
request until Play. Live video checksum matches the reviewed local artifact.
Strict build/TypeScript, touched lint and candidate/live health pass. The static
player is script-free; the video is not preloaded onto the app's main routes.
See [recording evidence and reproduction](showcase-walkthrough-2026-09.md).

Dynamic failure paths: **DONE for scoped missing-record acceptance**. App source
`77ab6ba`, Production `dpl_5zJCViodSCcBuwHXdqA2qeBnDVqz`, stable Preview
`dpl_D4CRjRXxv5Qkn9tBRnoXXSyHL8J6`. An unavailable trade no longer sends the user
back automatically. Explicit retry/return and 44 observations across 22 dynamic
URLs at 360/2560 pass locally, Preview and Live (two focused tests per environment).
Strict builds, health checks and touched lint pass (one pre-existing callback
warning). Real Chrome verifies the Live state and return to Trading. No payment,
refund or wallet mutation occurred. See [scope and evidence](dynamic-route-errors-2026-09.md).

Live digital acceptance: **capture and protected downloads DONE; refund BLOCKED
on owner approval and merchant funding/hold resolution**.
The owner paid 29 NOK; capture `0RV7577637864821N` and order
`cmug9nlar000204l0bjkgz91o` are COMPLETED. Real Chrome downloaded the JPG and TXT;
both sizes/checksums match. Two entitlements, each used once; raw access 403,
anonymous signed links 401, unrelated signed-in account 403. The refund is a
separate owner approval, not implicit in completing this payment. A fresh run of
69 private-storage, download-entitlement, PayPal proof, signature, webhook and
refund-policy unit tests passes. These do not substitute for Live acceptance.
The [PayPal runbook](paypal-setup.md) now separates current results from historical
setup observations and includes the exact download/refund acceptance procedure.
See [Live digital evidence](live-digital-acceptance-2026-09.md), including the
independently verified receiving-mail-server delivery and human-read boundary.

Unpaid order recovery: **DONE for deployed resume/cancel behavior**. Continue payment
reuses the existing purchase; confirmed cancellation keeps records/cart and daily
caps. 49 unit cases, three isolated Postgres tests (including 12 capture/cancel
races), strict builds and two focused browser tests in local/Live/Preview pass.
Real Chrome cancelled an expired Sandbox order without affecting its paid sibling;
Live confirmation/Keep order was checked without cancelling or buying anything.
Source `3d29861`, Production `dpl_B5uj2WYZ2s5kfaigvtV58DtQBaQv`, stable Preview
`dpl_DmeQLPLQntt4NQzuEVNy7PRuNrY4`. Real Sandbox approval links were subsequently
resumed from history on local and Preview, then cancelled with no captures,
credits or downloads granted. The five-minute throttle was respected, not reset.
See [order recovery evidence](order-recovery-2026-09.md).

Permanent purchase copy: **local, Live and Preview verified**. Purchase record
version `2026-09-25.1` removes stale reviewer/test-product descriptions, identifies
Fjord Study and Veggat AI Credits, and includes the shipped image/video allowance.
Published consumer-rights clauses are unchanged; historical records retain their
original text. 81 focused tests, lint and strict builds pass. Source `210660a` is
promoted to Production `dpl_HYFrgsVnPvkNwHZdnvcZFbP4zDUj` and stable Preview
`dpl_F8jw2vSa7wh9VAxF7Ze3E76LunkH`; both candidate health checks passed.
The public terms browser check passes locally, Live and Preview: eight viewport
sizes, no JavaScript required, current downloadable terms and stale-version rejection.
Artifacts: `test-results-release-product-terms-{local,live,preview}`. No extra
payment, credit grant or provider generation was made during these release checks.

AI Studio: **DONE for bounded image/video generation locally and Live**.
Source `2579e7e`, deployment `dpl_CXhgmxsb5YnFy3Jofmk9YqD691uH`.
Real Chrome generated and downloaded an OpenAI PNG and a four-second silent Grok
MP4 in each environment. The explicitly authorized Live allowance went 86 → 80 → 0;
both reservations completed once. Raw storage returns 403; anonymous app access
401; another signed-in account 404. Local/Live responsive, recovery and product
checks pass at 360–2560 in both themes. 64 database/lifecycle and 76 focused unit
cases pass (overlapping coverage). Builds/typechecks pass; no new lint errors.
No PayPal purchase was made. Longer videos, edits, media BYOK and scheduled-worker
execution evidence remain outside this acceptance. See [Studio evidence](ai-studio-2026-09.md).

Live 9 NOK starter: **DONE for owner-approved capture and one ten-credit grant**.
The owner completed the existing order with another buyer account after the
merchant-account rejection. Capture `8N819301P61947841`, order
`cmug44q96000004l8zgx0cxo9`, 900 ore / NOK: attempt and payment completed,
exactly one +10 purchase entry. The Live webhook returned 200. That balance later
funded two real Chrome replies: OpenAI Luna (2) and Grok (8), leaving 0. Read-only
ledger verification confirms both COMPLETED reservations and no refund adjustment.
Live digital purchase/refund acceptance remains open. Compact receipt layout is
**local and Live verified** (19 units, build/lint and 2 browser checks per environment),
deployed as `dpl_Gufib3EFRKsz74egBM3PGm2CKhsM`.
See [receipt and Live starter evidence](receipt-layout-2026-09.md).

Permanent products and automatic credit inputs: **local and Live verified**.
Production source `fe53a27`, deployment `dpl_4UEfGuXr436T3R1gitcbjBaJEyff`.
Seven focused product/input/layout checks plus four catalog/copy checks pass in
each environment, across phone, landscape, portrait, desktop and ultrawide.
98 focused units pass (21 database-gated cases skipped in this run).
Live artifacts: `test-results-release-product-polish-live-final` and
`test-results-release-product-copy-live`. Private JPG/TXT access checks passed;
anonymous raw access is denied. No additional Live purchase was made.
Product names are Veggat AI Credits and Fjord Study — Digital Artwork. Historical
orders and stable SKU IDs are retained. The entered budget is preserved, but
exact foreign-currency settlement is not implemented: whole-credit totals remain
server-priced in NOK. Anthropic needs `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY`;
image/video generation is now verified in the newer Studio slice above. See
[product and provider evidence](permanent-products-2026-09.md).

Invalid-session recovery: **DONE for scoped local/Preview/Live acceptance**.
Source `775c07d`, Production `dpl_7Qme9rWWkaYXxAUEM7D1sU7rS6sT`, Preview
`dpl_HYATp3FnCWFuqgBMwVskvC2HoWYL`. Real Chrome revealed a returning-user trap on `/nexus`: an invalid JWT
became a non-null session with no user. Returning `null` from JWT invalidation
uses normal Auth.js cookie clearing. Eight new callback/handler tests and 26
related auth tests pass, plus strict build/lint, 3/3 local and Preview browser
checks and 2/2 Live security/recovery checks.
The same pre-fix browser test reproduces locally, on Preview and Live. See
[session recovery evidence](stale-session-recovery-2026-09.md).
Local Google + GitHub are **DONE for real-Chrome callback/login acceptance**.
An approved development-only secret corrects the local client mismatch. The
owner-approved signed-in GitHub link, logout and GitHub login resolve to the same
isolated test account as Google. Email confirmation / trust badges remain pending.
No production provider configuration or account link was changed.

9 NOK starter Sandbox payment: **DONE for fresh real-Chrome capture, ten-credit
grant, receipt refresh and webhook replay**. Authenticated PayPal capture and
isolated database checks match; both webhook deliveries returned 200 and only
one +10 grant exists. Purchased credits then funded a real OpenAI reply, 10 -> 8;
the 60-credit model was blocked without a reservation. The existing zero-credit
Live demo again passed UI blocking and server 402 with no new grant/provider call.
See [starter acceptance](sandbox-starter-acceptance-2026-09.md).
The initial Live capture was unverified. The owner attempted the 9 NOK starter on
25 September, but PayPal rejected the receiving merchant account as the buyer.
A read-only production check of order `cmug44q96000004l8zgx0cxo9` / PayPal order
`3XL1972193645690B` found `APPROVAL_PENDING`, 900 ore, no capture/completion and
no purchase grant. This is not a successful payment. A separate buyer must
complete approval; this later succeeded as recorded at the top of this document.
Sixty focused webhook, receipt, refund-policy and download tests pass. The
receipt test double now renders the checkout's server-provided order/summary
slots so the existing pre-payment adjustment disclosure remains covered; no
payment runtime or deployment changed for this test-only correction.

Checkout + credit-budget refresh: **DONE for scoped local/Preview/live UI and
pricing acceptance; S4 money acceptance remains PARTIAL**. Source `db145f7` is
deployed as Production `dpl_8Dg2DatTEJRpRNZ3jpLE875m9WFu` and Preview
`dpl_79mwE3RQZ9jEhVS8jvG53KQRiUs9`; main-domain deployment inspection and health
pass. Balanced checkout, explicit delivery in the main column, compact help,
quantity-neutral artwork and linked credit/fiat-budget inputs support 100–10,000
credits plus the 9 NOK starter. Server margin guard, two-attempt cap and a bounded
5,000 NOK daily exposure limit remain. 137 focused units (including request detail),
41 further payment/ledger units, then all 30 explicit isolated-Postgres ledger
checks (including the previously skipped 21), isolated PostgreSQL prepare checks,
strict builds/lint and focused browser flows pass. Hosted Preview is 6/6 and Live
4/4; payment POSTs are mocked/blocked. Real Chrome local budget entry and hosted
checkout page/footer/drawer scrolling pass. Fresh Sandbox capture is separately
recorded above; no Live capture is claimed. See
[checkout evidence](checkout-credit-budget-2026-09.md).

Request detail: **DONE for scoped local/Preview/live acceptance** in the same
release. 18 units and 2 browser tests per environment cover gallery, long-content reflow in both themes,
outage recovery and 401/403/404 distinctions without stale private details.
No real request was published or another account's access changed.

Request-board cached-access correction: **DONE for this slice locally and live**.
Source `b66f49f`, deployed `dpl_5PWt1ynV7w2N6KAoy8yFubwh8gjf`, clears private
cached rows after 401/403 and prevents resurrection on a later outage. Baseline
browser reproduction failed; **9 units**, strict builds/lint and **2/2 focused
browser checks per local/live** pass. Real Chrome actual empty-board refresh
also passes. No membership or publication was changed. Dynamic request-detail
coverage is now recorded above. See [request-access evidence](request-access-2026-09.md).

Interview artifact cleanup: **DONE in the release worktree**. Historical
`REBUILD_PROMPT.md`, `REVIVAL_PROMPT.md`, `monetisation.md` and the three-line
`prd.md` moved from the root to `docs/archive/early-concepts/`, with an explicit
historical/non-authoritative notice. Text preservation checked against Git HEAD
(only newline normalization), guide links verified, and agent status references
now point to this scoreboard. No original design notes were deleted and no
runtime change or deployment is needed. The recording and full acceptance gates
remain open; this cleanup is not a claim that S9 or the entire mission is done.

Homepage marketplace story: **DONE for this slice locally and live**.
Source `a6ba219` clarifies the digital-product flow and experimental modules,
repairs mobile word wrapping, improves feature-link targets/focus, and corrects
the Settings destination. Strict build, touched lint and **2/2** focused local
browser checks pass at 360/390/1280/2560. Production
`dpl_96gLAzdykhhDeEbsNSH3qDYVyPf3` passed strict build and the public navigation
test on its candidate alias before promotion and on www.veggat.com afterward.
Real Chrome owner Settings navigation also passes without changing account data. See
[homepage evidence](homepage-marketplace-story-2026-09.md).

Preview Google callback: **saved with explicit owner confirmation**. Existing
six callbacks unchanged. Real Chrome retry reached a browser-extension security
warning for Preview `/nexus`; stopped without bypass. Owner warning inspection
is required before continuing that flow. PayPal Sandbox buyer access was already
restored; a new sign-in request to PayPal is not currently the blocker. See
[Preview configuration evidence](preview-deployment-preflight-2026-09.md).

Demo refusal recovery: **local, Preview and live verified for this slice**.
Source `b8b03d8`, 30 provisioning/policy units, strict build, two local refusal
checks and one local auth protocol check pass. Preview exposed branch-scoped
AUTH_URL/PAYPAL_WEBHOOK_ID values missing from CLI deployments. Explicit
Preview-only build/runtime values fix the observed callbacks-to-production and
webhook-503 failures; `dpl_52SXaPka2Kp7nCgdcJsWWCHfH4MZ` passes **3/3** focused
checks on the stable Preview alias. Future CLI Preview deployments must retain
these overrides until branch selection is resolved. Production
`dpl_6CH8kjDUcoZwbfxaEJ7sfxniLtUe` (source `a3f0055`) is promoted to
www.veggat.com after its strict Production build. Live **2/2** focused checks
pass, and real Chrome Home-to-Marketplace navigation renders the reviewer
products. This does not prove a new successful demo sign-in after the cap resets,
full OAuth consent, or Live payment acceptance.
See [demo recovery evidence](demo-refusal-2026-09.md).

Route audit/storage resilience: **DONE for scoped rendering regressions locally,
Preview and live; full interaction audit remains PARTIAL**.
Candidate `ac82106` fixes an unattended storage initialization rejection and
moves a development-only preview guard to the server. **24 units**, touched lint,
strict build and local **4/4 browser checks** pass, including 77 static routes at
390/2560. This is rendering/scroll-input triage, not all-button or all-role
acceptance. Production `dpl_99ac3nJpvGP48cqbTZhg7BzNxY9p` is promoted and the
live batch passes **3/3** (154 static-route observations plus targeted failures).
An additional fresh-demo checkout attempt locally hit the existing busy/limit
path and is not claimed as passing; no safeguard was weakened.
[Evidence and remaining dynamic-route scope](route-inventory-2026-09.md).

Backend container: **DONE locally and deployed on Railway**. Node 22,
non-root runtime, Windows and Linux security tests **5/5**, running-container
health/mock shipping/retired endpoint checks pass. The owner restored Hobby.
Release `3234d9b` is deployed; live health is 200 and retired endpoints are 410.
Old Live Bring credentials failed; explicit mock shipping now returns 200 with
two options. Active deployment: `6edc4888-6a6b-4fef-a1c6-5a0ba0276104`.
No billing changes were made by the agent. See [backend evidence](backend-container-2026-09.md).
This does not change the deployed frontend or complete the full scoreboard.

Catalog first render: **DONE for this scoped slice**. App **`e8252bd`** plus
test **`53b4dfd`**, production **`dpl_9vx4UsAL6W2EC9NLdD3fSSAj46DS`**, verified
on www.veggat.com. Product cards and the first image preload now arrive in
server HTML; the duplicate initial browser catalog request is removed. Existing
filters, pagination, public visibility and purchase authority are preserved.
**21 units**, touched lint, strict builds and **9/9 focused browser checks per
local/Preview/live** pass. Eight-size scrolling/layout checks include 360 and
2560; real Chrome phone page/filter scrolling was also inspected. See
[evidence, initial test failures and rollback](catalog-first-render-2026-09.md).
No new field-speed score is claimed. The full-app scoreboard is not complete.

**Live payment remains UNTESTED.** The new 9 NOK Sandbox capture/replay check
awaits resolution of the Preview browser security warning described above.
This release performed only demo-cart checkout navigation, not provider capture.
The owner's pending 10-credit/9 NOK selection and earlier receipts are unchanged.

### Previous lower-cost credit slice

Lower-cost credit selection: **DONE for pricing/cart/checkout readiness**.
Source **`a095d0e`** plus test **`226744f`**, deployment
**`dpl_9LVVv2jJJMeYcQrEVCT55Etm4rdD`**, on www.veggat.com. An explicit
**10-credit starter costs 9 NOK**; the 100-credit pack stays 39 NOK. Existing
receipts are unchanged. All **159 scoped units**, **10 isolated database
constraint checks**, strict builds/lint, and the starter-pack browser journey
on local/Preview/live pass. The real Chrome checkout now has the owner's
requested smaller selection saved, with delivery consent unchecked and no
payment submitted. See [evidence and limitations](small-credit-pack-2026-09.md).

**Live capture/refund remains UNTESTED**, including the original 39 NOK option.
Actual 9 NOK Sandbox capture is also not implied by the mocked checkout test.
Next money step is provider capture/replay acceptance of the starter amount,
then an owner-approved Live purchase; no further 39 NOK test is required.
Full-mission route, auth/provider and external-account gaps below remain open.
Vercel's failed-payment warning needs owner billing attention; billing unchanged.

### Previous analytics access slice

Analytics access recovery: **DONE for this scoped slice**. Source **`9c437cd`**,
deployment **`dpl_ASxDaUbduMNpF9P2YLTdXwLpPxcg`** on www.veggat.com. A 401/403
refresh now clears previously displayed private reports; a later 503 cannot
restore them. Normal transient errors still retain authorized data. Strict
builds, touched lint, **28/28 units** and **6/6 browser checks per local, Preview
and live** pass. Real Chrome verifies actual demo table controls and scrolling.
See [evidence and rollback](analytics-access-acceptance-2026-09.md).

**Live payment is UNTESTED.** The owner explicitly corrected the apparent
purchase report: no 39 NOK payment has been confirmed. The current Live webhook
configuration is verified, but it is not capture evidence. A **9 NOK / 10-credit**
starter option is now deployed to reduce the cost of future Live testing;
normal 100-credit pricing and existing receipts stay unchanged. See
[starter-pack acceptance](small-credit-pack-2026-09.md). No further 39 NOK test
purchase should be requested. Other full-mission gaps below remain open.

### Previous warehouse slice

Warehouse reliability and responsive read path: **DONE for this scoped slice**.
App authority is **`72e528e` / `dpl_G8smj6frN5e8EVfje5tRrar43owu`** on
www.veggat.com. Refresh retains the empty card and valid rows without a layout
jump; errors no longer masquerade as empty data, revoked access clears saved
details, and long addresses wrap on phones. Stock adjustments reject negative
stock, overflow and mismatched warehouses while preserving ADMIN-only writes
and version conflict protection.

Strict builds, touched lint, **26/26 units**, **6/6 browser checks per local,
Preview and live**, plus **1/1 real isolated-database read/access check on local
and Preview** pass. The first live run exposed an ambiguous test selector, not a
layout failure; that correction and reruns are recorded. Real Chrome verifies
actual live inventory expansion/detail/refresh, phone footer scrolling and local
independent mobile navigation. No live stock, payment or credit was changed.
Testing/UI-guidelines skills informed read recovery, touch targets and actual
scroll verification. See [evidence and rollback](warehouse-acceptance-2026-09.md).

**Still PARTIAL:** owner Live purchase/refund, human-inbox delivery/legal review,
remaining OAuth/wallet/backend checks, verified Web3/general-listing checkout,
exhaustive route interactions, native 125% zoom and physical-phone keyboard
acceptance. Actual admin stock-write/concurrency acceptance is not implied by
mocked units. Next slice: analytics/workspace controls and remaining owner-gated
payment/auth acceptance. The full production mission is not complete.

### Previous display-rate slice

Display-rate reliability and historical price explanation: **DONE for this
scoped slice**. App authority is **`bbadc04` /
`dpl_Gh1cjhYcXTydb3T3qnsxoZ3TureT`** on www.veggat.com. Cold rate outages no
longer invent conversions; cached stale quotes stay stale across reloads, and
the currency menu offers status/retry. Fresh-cache reuse avoids an unnecessary
request. Receipts and buyer/seller orders distinguish current display estimates
from unchanged recorded amounts. Landscape menu actions are more compact.

Both new regressions fail on preceding source and pass after correction. Strict
builds, touched lint, **89/89 units**, and **7/7 scoped browser checks on each of
local, isolated Preview and live** pass. Global currency/overflow coverage spans
eight sizes, 360–2560. Tests only prepare/restore an empty disposable demo cart;
no payment, refund or credit grant occurs. Real Chrome verifies phone receipt
scrolling and landscape menu scrolling locally, real Preview rate refresh and
live desktop quotes. Its selected-tab viewport limitation is recorded rather
than counted as live mobile evidence; the override was reset. See
[evidence, limitations and rollback](display-rate-acceptance-2026-09.md).

**Still PARTIAL:** owner Live purchase/refund, human-inbox delivery/legal
sufficiency, remaining OAuth/wallet/backend checks, verified Web3/general-listing
checkout, exhaustive route interactions, native 125% zoom and physical-phone
keyboard acceptance. No whole-app accessibility, financial, security or field
performance certification is implied. Next slice: remaining route/scroll
interactions and release gaps, plus owner-dependent acceptance when available.

### Previous listing price slice

Listing currency, decimal entry and core form accessibility: **DONE for this
scoped slice**. App authority is **`08d9937` /
`dpl_3maNEBbPW77m28QLgu127w64hT9P`** on www.veggat.com. Restored NOK drafts no
longer show USD in a separate selector; dot/comma decimals are preserved without
silent reinterpretation. Core fields and preference controls have larger targets
and accessible labels, and shared form errors have readable light/dark colors.
The form accurately distinguishes reviewer PayPal from unreleased general/Web3
checkout. UI/testing skills informed labels, contrast, reflow and evidence.

The two new regressions fail on the preceding source and pass after correction.
Strict builds, touched lint, **47/47 focused units**, **4/4 browser checks on each
of local, isolated Preview and live**, and **1/1 real stale-context private upload
and publication on both local and Preview** pass. Cleanup completed for the
temporary sellers; no live listing, purchase or refund was created. Real Chrome
checks actual mobile input and keyboard scrolling, deployed Sandbox/Live status,
and the owner session; temporary viewport restored. See
[evidence, limitations and rollback](listing-price-acceptance-2026-09.md).

**Still PARTIAL:** owner Live purchase/refund, human-inbox delivery/legal
sufficiency, remaining OAuth/wallet/backend checks, verified Web3/general-listing
checkout, full-route interaction, native 125% zoom and physical-phone keyboard
acceptance. This is not a whole-app accessibility, performance or production
certification. Next slice: remaining route/scroll interactions and historical
price explanation; continue owner-dependent acceptance when a session is ready.

### Previous seller publication slice

Seller publication and private-file registration: **DONE for this scoped
engineering slice**. Its app authority was **`9eac374` /
`dpl_Epxd7YKi27qXwmqF8AfdwMcAN1Nb`** on www.veggat.com. Publication is atomic;
file/company/wallet/warehouse ownership is checked; private bytes receive a real
checksum. Review exposes errors and restores focus, and demo publication remains
disabled. A real repeated Preview test exposed stale guest upload context after
login; a controlled regression reproduced it, and refreshing context before
upload fixes it without relaxing server checks.

Strict builds, touched lint, **77/77 units**, **4/4 real Postgres cases**,
**2/2 read-only browser checks plus 1/1 dark replay per local/Preview/live** pass.
Actual private upload/publication, decoded product image and stale-context
recovery pass separately on local and isolated Preview; temporary listings are
archived and test sign-in disabled afterward. No live listing or paid transaction
was created. Real Chrome verifies local review focus, deployed Preview review,
and actual live phone scrolling to the truthful owner tools. Testing/UI-guidelines
skills informed recovery, labels, reflow and the evidence boundaries.
See [exact evidence, failures and rollback](seller-publication-acceptance-2026-09.md).

**Still PARTIAL:** owner Live purchase/refund, human-inbox delivery/legal
sufficiency, remaining OAuth/wallet/backend checks, verified Web3/general-listing
checkout, full-route interaction, native 125% zoom and physical-phone keyboard
acceptance. Runtime audit is 0 critical/high and 25 moderate, not a full clean
repository audit. Next slice: saved-draft currency consistency and seller-form
accessibility/contrast; do not enable an unverified checkout path.

### Previous purchase-availability slice

Purchase availability and paused-delivery protection: **DONE for this scoped
engineering slice**. Its app authority was **`6816380` /
`dpl_72qycJnr4Zwp4os4xyFxRmBFJ7Xj`** on www.veggat.com. Catalog/PDP controls now
match the existing reviewer-only checkout scope; mixed carts identify what
needs attention. New checkout preparation rejects delivery-paused products
before creating an order/attempt. Capture and refund reconciliation is unchanged.
Strict builds, touched lint, **78/78 units**, **6/6 local, 6/6 Preview, 6/6 live**,
plus a **1/1 dark replay** in each environment pass. Availability layout is
checked at eight sizes, 360–2560. Real Chrome verifies local phone search,
eligible credits controls and actual footer scrolling, plus the live owner
default-status label. No new payment or publication was performed.
See [evidence, fixture boundaries and rollback](purchase-availability-acceptance-2026-09.md).

**Still PARTIAL:** owner Live purchase/refund, human-inbox delivery/legal
sufficiency, remaining OAuth/wallet/backend checks, verified Web3 checkout,
general-listing checkout, historical-price explanation, full-route interaction
and native 125% zoom. No whole-app or field performance approval is implied.
Next slice: seller listing/review recovery and accurate publication/payment
messaging; inactive legacy checkout remains fail-closed.

### Previous product-read slice

Product reads and honest payment availability: **DONE for this scoped
engineering slice**. Its app authority was **`6654f24` /
`dpl_HmPFfAVgHNXUxj6s2TSf6rARTHhy`** on www.veggat.com. Internal read helpers no
longer register as Server Actions; detail reads are minimal, permission-checked,
non-cacheable, and distinguish retryable outages from absent products. Direct
product visits avoid four catalog-only requests while preserving search on
return. Payment capability reporting separates reviewer PayPal from paused
general-marketplace checkout; it no longer advertises unreleased crypto.
Strict builds, touched lint and **27/27 units**, plus **7/7 local, 7/7 Preview,
7/7 live** scoped browser checks pass. Real Chrome verifies local product/search
navigation, actual scrolling and gallery controls at phone width, and live owner
status at 390 and 1280 without changing switches. Composition guidance kept
request policy in the existing provider; UI guidance informed reflow and honest
status presentation. See [evidence, failed attempts and rollback](product-read-acceptance-2026-09.md).

**Still PARTIAL:** owner Live purchase/refund, human-inbox delivery/legal
sufficiency, remaining OAuth/wallet/backend checks, verified Web3 checkout,
general-listing checkout, historical-price explanation, full-route interaction
and native 125% zoom. No whole-app or field performance approval is implied.
Next slice: catalog/purchase availability and remaining presentation defects;
the inactive legacy checkout must remain fail-closed.

### Previous marketplace continuation slice

Marketplace continuation routes and product loading: **DONE for the scoped
engineering slice**. Its app authority was **`b690441` /
`dpl_EiugCUHSc2R8ffFm6Gto9qMtRs2e`** on www.veggat.com. Daily Deals and Member
Discount now have bounded, accessible guidance and real product links instead
of blank dead ends. Promotions/memberships are explicitly planned, not active;
no new promotion engine or payment method is implied. The inventory alias
redirects server-side while Trading remains protected. Catalog loading is now
isolated in a URL-neutral route group so product detail cannot inherit it.
Strict builds, touched lint, **33 focused units**, and final **5/5 local,
5/5 Preview, 5/5 live**, each with a **1/1 dark replay**, pass. The first Preview
was 4/5: its loading flash was fixed before promotion, not waived by a warm retry.
Web Interface Guidelines informed bounded reflow, focus, native disclosures and
44px targets. Real Chrome verifies local catalog → product loading → product,
live offer navigation/FAQ/credit product and actual wheel scrolling to the footer.
See [route acceptance, failed attempts and rollback](marketplace-routes-acceptance-2026-09.md).

**Still PARTIAL:** owner Live purchase/refund, human-inbox delivery/legal
sufficiency, remaining OAuth/wallet/backend checks, historical-price explanation,
verified Web3 checkout, full-route interaction and native 125% zoom. This is not
whole-app approval or field Core Web Vitals evidence. Next audit: remaining
product-read/loading and payment-availability paths without enabling unsafe
legacy checkout.

### Previous consent and scroll slice

Consent controls and scrolling: **DONE for the scoped engineering slice**.
Its release was **`c3977b7` / `dpl_icFDX1ttc5932VRK9HZtc2Kaiuyw`**,
retained in the current app above. Dismissal immediately removes the banner hit area; bounded
content and persistent actions fit 360–2560px and short landscape. Anonymous
users can reopen preferences in the common menu. Analytics/Speed Insights are
opt-in and retained callbacks reject events after revocation; receipt IDs are
removed from telemetry URLs. Strict builds, touched lint, **25 focused units**,
and **6/6 local, 6/6 Preview, 6/6 live**, each with a **1/1 dark replay**, pass.
Real Chrome verifies local footer scrolling and live menu/focus/feed scrolling.
UI/animation guidance informed contained scrolling, focus and reduced motion.
See [consent evidence, boundaries and rollback](consent-scroll-acceptance-2026-09.md).

**Still PARTIAL:** owner Live purchase/refund, human-inbox delivery/legal
sufficiency, remaining OAuth/wallet/backend checks, historical-price explanation,
full-route interaction and native 125% zoom. Daily Deals and Member Discount
have their subsequent scoped acceptance above. This is not
whole-app approval or field Core Web Vitals evidence.

### Previous AI conversation navigation slice

AI conversation navigation: **DONE for the scoped engineering slice**.
Its release was **`a8ce335` / `dpl_6HAJX4GQhTNZETCPQe5V9GUGfUUP`**
(application changes `eb1b784`), retained in the current app above. Loading, empty and failure
states are distinct; bounded server search, private compact pagination and
stale-response protection replace the first-50-only rail. Rename Cancel no
longer commits on blur. Deleted conversations and inactive memberships do not
grant transcript reads; owner/demo/origin/rate checks guard rename/delete.
Strict builds, touched lint, **95 focused units**, and final **4/4 local,
4/4 Preview, 4/4 live** scoped browser checks pass; 21 opt-in ledger cases were
skipped, not counted as passed. Real owner Chrome verifies loading, search,
Cancel, refresh and reopening a saved transcript without a write/provider call.
See [AI navigation evidence, limits and rollback](ai-navigation-acceptance-2026-09.md).

**Still PARTIAL:** owner Live purchase/refund, human-inbox delivery/legal
sufficiency, remaining OAuth/wallet/backend checks, historical-price explanation
and full-route interaction/native 125% zoom. This is not whole-app approval.

### Previous personal Sales slice

Personal Sales dashboard: **DONE for the scoped engineering slice**.
Its release was **`0699868` / `dpl_GQDV8P3CbfNz2WNNYAfEdvR4HXZh`**,
retained in the current release above. One bounded, authorized request replaces six requests; error,
empty, stale and loading states are distinct. Demo orders without a Payment row
are explicitly not paid; mixed orders do not expose whole-order payment data.
Strict builds, touched lint, **238 focused units**, **4 real isolated PostgreSQL
tests**, and **4/4 local, 4/4 Preview, 4/4 live** scoped browser checks pass.
Real owner Chrome confirms demo labels and actual wheel-scroll/footer behavior.
Its viewport override did not apply; mobile evidence is Playwright, not a claimed
physical-device test. One historical crypto order still lacks a usable display
currency; the total fails closed rather than inventing a value. See
[Sales evidence, limits and rollback](sales-dashboard-acceptance-2026-09.md).

**Still PARTIAL:** owner Live purchase/refund, human-inbox delivery/legal
sufficiency, remaining OAuth/wallet/backend checks, historical-price explanation
and full-route interaction/native 125% zoom. This is not whole-app approval.

### Previous full-terms slice

Full published terms retention: **DONE for the scoped engineering slice**.
Its release was **`4b77afb` / `dpl_3LU97pZnwY1w4Kh9W5mMZWEqDR6d`**,
retained in the current release above. New checkout snapshots and original confirmation attachments
include the complete versioned sales terms and optional withdrawal form. Earlier
records remain byte-identical. The public document is usable without JavaScript;
eight-size scroll/download tests pass. Strict builds, touched lint, **241 focused
units**, six isolated checkout scenarios, four local/Preview scoped journeys and
**3/3 live** checks pass. Fresh local demo provisioning hit its existing cap;
retained local-demo checkout passed, and fresh Preview/live login passed. No cap
was bypassed. See [full terms evidence and limits](full-terms-acceptance-2026-09.md).

**Still PARTIAL:** owner Live purchase/refund acceptance, human-inbox delivery
and legal sufficiency, remaining OAuth/wallet/backend checks and full-route
interaction/native 125% zoom. Sales dashboard acceptance is now recorded above.

### Previous seller-request slice

Seller request review: **DONE for the scoped slice**, not whole-app completion.
Its original release is **`a902b42` / `dpl_2Ed57ytaWJr1BzyuE8ueLH6F2K1F`**,
retained in the current app above. Whole-order authorization, demo privacy, revision conflicts and
the distinction between review approval and verified money movement are enforced.
Strict builds/touched lint, **229 units**, **4 real isolated PostgreSQL cases**,
and final **5/5 local, 5/5 Preview, 5/5 live** browser batches pass. The real query
tests caught and fixed nullable SQL authorization before deployment; the first
Preview navigation failure and unchanged reruns are recorded, not discarded.
Real Chrome verifies the owner inbox and retained no-paid-consent demo evidence.
No actual seller decision, paid transaction or new customer email was submitted.
See [seller review acceptance, limits and rollback](seller-review-acceptance-2026-09.md).
The earlier deployment IDs in the sections below are historical.

**Still PARTIAL:** owner Live purchase/refund acceptance, human-inbox delivery,
human durable delivery/legal review, remaining OAuth/wallet/backend
checks and full-route interaction/125% zoom. The later Sales slice above fixes
the legacy dashboard's empty/error behavior separately from this inbox.

### Previous transactional email slice

Transactional email follow-up: **PARTIAL**, guarded outbox and original-copy
downloads are deployed as **`82727bd` / `dpl_5yuYw7bESbW9aW6AWsSjM6xFmsrr`**
on www.veggat.com and retained in the current release above. Strict builds,
**215 unit checks**, **3 real isolated
Postgres cases**, and **3/3 local, 3/3 Preview, 3/3 live** browser checks pass.
Authenticated scheduled-job probes return 200/configured; public and forged
requests return 401. Preview branch-prompt configuration failure was caught by
the positive probe and corrected before promotion. The configured Resend key is
**sending-only**, not invalid: a synthetic email/attachment was accepted, while
domain/history reads return `restricted_api_key` (401). Inbox delivery remains
unverified. See [email outbox evidence and exact
boundaries](transactional-email-acceptance-2026-09.md). Do not count provider
fixtures as delivered customer mail. Seller review has its own later evidence above.
No historical customer mail was queued, no Live payment/refund was submitted,
and neither Vercel's overdue-billing warning nor GitHub's billing lock was changed.

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
| Auth | Google | DONE for existing-account local/Live real-Chrome sign-in and logout; automated-browser restriction remains, not bypassed |
| Auth | GitHub | DONE for existing-account local/Live real-Chrome sign-in and logout; separate email/trust-badge confirmation is not claimed |
| Auth | Discord | PARTIAL — correct Live callback/S256 consent screen and safe cancellation observed; positive local/Live callback/link requires explicit owner consent |
| Auth | Account/Security settings and deletion request | PARTIAL — allowlisted personal and audited privileged edits, atomic confirmation, safe request/cancel, version/deadline checks, durable End Preview/preview Sign Out revocation and responsive local/Preview/Live recovery pass; real credential/email acceptance, verified email replacement, erasure review, role-management step-up and ownership transfer remain; ordinary non-preview JWT logout semantics are unchanged |
| Shop | List, PDP, images | DONE — permanent artwork/AI-credit products and real images verified locally/live |
| Shop | Cart | DONE — two lines, reload, quantity/removal, stable ordering and badge synchronization locally/live |
| Shop | Checkout | DONE for verified demo/Sandbox/Live purchase paths — server quotes, custom-credit edits, retries, unpaid-order resume/cancel and request follow-up tested; see separate refund limitation |
| Shop | Live PayPal, sandbox PayPal | PARTIAL — Sandbox capture/refund/replay and Live 9 NOK credits plus 29 NOK artwork capture/fulfillment pass. Live refund is BLOCKED on separate owner approval and merchant funding/hold resolution; no refund submitted |
| Shop | Confirmation, signed download | DONE for scoped purchase/access checks — actual Live JPG/TXT downloads match stored checksums; raw 403, anonymous signed 401 and unrelated account 403. Human email delivery remains unverified |
| Shop | Cheap JPG+TXT product, credits SKU | DONE — permanent products deployed; fixed/custom mixed Sandbox captures and Live starter/artwork purchases verified. Historical SKU IDs and order copies retained |
| Shop | Buyer notices / seller review | DONE for scoped local/Preview/live flows — private originals, retained drafts, whole-order permissions and revision checks; not an automatic refund or legal-compliance certification |
| AI | Chat, selector, streaming | DONE for tested OpenAI Luna/Groq demo and Sandbox-funded OpenAI Luna/Astra/Grok paths; other unconfigured models remain disabled |
| AI | Credit debit, zero balance, no overcharge | PARTIAL — demo server 402, Sandbox spending/denial and actual Live purchased balance 10→8→0 verified. Atomic ledger/fuse tests pass. Provider-project hard caps/alerts still require acceptance; no absolute overcharge guarantee |
| Wallets | Connect UI, no crash | PARTIAL — injected-wallet cancel/connect/disconnect passes local/live; configured WalletConnect open/escape and configuration units pass; owner-wallet verification pending |
| Platform | Public homepage | DONE — S1 verified locally and live |
| Platform | Consent controls Analytics/Speed Insights | DONE — no scripts before consent/Essential Only; both 200 after opt-in; real visitor metrics pending |
| Platform | Health | DONE for deployed integration core — local and Railway `/v1/health` 200; live mock shipping returns two options; retired write endpoints return 410/no-store. Live Bring is not verified. |
| Experimental | Warehouse list/detail/refresh | DONE for scoped reads — phone/ultrawide, real isolated access checks, live read-only inventory expansion and footer scrolling; stock-write guards unit-tested, real admin mutation acceptance remains separate |
| Quality | Touched-file lint | PARTIAL — run after each slice |
| Quality | Home → demo → product → cart E2E | DONE — local and live pass; payment coverage remains a separate S4 task |
| Quality | Payment mocked in CI | BLOCKED — workflow implemented and local demo/retry/replay passes; GitHub rejects execution due to account billing lock. Provider transport mocked in unit tests |
| Layout | Core path at 360 and 2560, other requested sizes, 125% zoom | PARTIAL — core route/drawer/scroll tests include 360/390/landscape/768/1024/1280/1920/2560; all-route interaction, real phone keyboard and actual Chrome 125% zoom remain unverified |
| Interview | Root README | DONE for the interview artifact — human story, architecture, four decisions, setup/tests, production limits and a published 76-second real Live demo with captions/text alternative. Whole-app acceptance remains separate |

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
  This earlier deployment blocker is **resolved** by the 24 September Railway
  release recorded above. Live shipping access control/provider limits still
  need further audit; the deployed shipping provider remains explicitly mocked.
- Active frontend warehouse notifications now contain only an invalidation marker,
  never stock/product DTOs; list/detail clients refetch through role-filtered HTTP.
  No new public inventory subscription is opened for demo/ordinary users. Focused
  warehouse tests **7/7**, touched-file lint and production build/TypeScript pass.
  Local warehouse read/refresh/back-navigation at 360/390/1280/2560 **2/2** (6.4s,
  including setup). Release `4c85955` / `dpl_DdBBcvSXMvPD7Eb4VJUn7EAXFt2p`
  is READY at www.veggat.com; live warehouse regression **2/2** (9.5s including setup).
  Selected payment tests **15/15** also pass. Privileged inventory mutation itself
  is still not claimed tested by the demo session.

- Current work is isolated in `DEV-VEGGASTARE-release` on
  `release/showcase-september`; the original dirty workspace is preserved.
- Local OAuth origin is `http://localhost:3000`.
- Current local production-style test process uses the isolated Neon Preview database through the guarded Sandbox launcher. No Live PayPal keys are added to localhost. Earlier live-database test observations above are historical, not the current routing.
- Real Chrome is connected and has been used for Sandbox checkout, credit-funded chat and the custom-credit/currency checks. Browser-blocked OAuth is not bypassed; owner consent still needs completion. Do not spoof Google's browser checks or telemetry automation exclusions.
- Demo creates a separate temporary USER per visitor, bounded to five per daily IP fingerprint and 200 globally/day in a serialized transaction; sessions expire after a day. The S5 candidate permits guarded private chat creation/messages and five one-time credits. Cart/demo-checkout remain isolated; real payments, public posting and provider-key changes remain denied.
- New paid entitlements must never be granted from client prices or a return URL. S4/S5 remain release blockers.
- Sandbox PayPal credentials are configured locally/Preview; Live credentials and webhook are Production-only. Both fixed Sandbox SKUs and the starter were purchased using test money. The owner subsequently completed one 9 NOK Live credit purchase, verified at the top of this document. No additional Live purchase or refund was performed during the permanent-product UI checks.
- The earlier Railway CLI authorization blocker was resolved through the
  connected Chrome dashboard. The active release and public backend health
  are verified above; CLI authorization is not used as deployment evidence.
- Payment implementation references: [PayPal environment separation](https://developer.paypal.com/api/make-api-requests), [Orders v2](https://developer.paypal.com/api/orders/v2), [idempotency](https://developer.paypal.com/api/rest/reference/idempotency/). Unsafe legacy capture/grant handlers now fail closed; webhook development bypass removed. Production webhook target is `/api/webhooks/paypal`.
