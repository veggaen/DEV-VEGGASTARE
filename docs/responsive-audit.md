# Responsive and interaction audit

Status: restarted after the reported Pulse footer/scroll defect. Earlier width-only
checks are not proof of mobile quality. Payment/auth security checks remain valid
within their documented scope; this audit does not reset or replace those checks.

## Acceptance criteria

- Reflow without horizontal **page** scrolling at 360 and 390 CSS px; also inspect
  390 landscape, 768, 1024, 1280×800, 1920, 2560 and 125% browser zoom. Include a
  320px reflow check. A deliberately horizontal carousel is not page overflow.
- Observe top, middle, and bottom using real wheel/touch/keyboard input. Record
  which element actually scrolls. A footer must follow content, not float over it
  or appear while there is feed content below it.
- Scroll sidebar/drawer independently through both boundaries. Background content
  must not move underneath an open modal drawer. Close with button and Escape;
  focus returns to the trigger. Test short landscape height, not just portrait.
- Sticky controls must not obscure focused fields, titles, or final actions.
  Check the composer/form with a shortened viewport; true OS keyboard behavior
  remains a physical-device check, not something a viewport resize proves.
- Inspect alignment, gutters, content width, readable type, image geometry,
  loading-to-content changes, empty/error states, and cookie/banner stacking.
- Prefer 44px touch controls on the interview path; check all unnamed controls,
  visible focus, reduced motion, and tap alternatives to gestures/hover.
- Record uncaught exceptions, console errors, failed same-origin requests, dead
  navigation, and unavailable features. Expected access denials are not crashes.
- Click safe controls and exercise scoped user flows. Do not blindly invoke
  deletion, public posting, account changes, or paid actions during a route sweep.

## Coverage rules

Inventory is derived from `frontend/app/**/page.tsx`, excluding private folders,
route-group names, and parallel/intercepted duplicates. Parameterized routes need
real seeded records; nonexistent IDs prove only the not-found state. Auth/token
callback pages require separate success/error flows. Admin access denial is not
an admin UI pass. Every route starts UNTESTED; status requires evidence.

Each result records route, session type, viewport, top/middle/bottom observations,
navigation/control coverage, defects, and screenshot/report paths. Automated
geometry scans are triage, not a substitute for viewing the screenshots.

The renewed research pass also uses W3C's evaluation methodology to distinguish
page inventories from complete processes and state coverage. Its accessibility
methodology does not replace payment/security QA or justify a whole-site WCAG
claim from a sample. Playwright's user-visible locators and isolated contexts
support repeatable interactions; full owner/provider sessions and physical-device
behavior remain separate evidence. Layout-shift investigations include late
auth chrome, not just image dimensions or skeleton-to-content measurements.

## Current findings

- `frontend/components/checkout/payment-verification.tsx`: crash left the entire
  uncommitted file as zero bytes; reconstructed before starting the local server.
- Real Chrome connector currently reports no connected browsers; native Windows
  helper reports missing pipe. Do not label Playwright as the owner's Chrome.
- Pulse: reproduced the reported footer jump by scrolling the real feed, then
  switching to its shorter Polls state. The retained outer scroll offset clipped
  the composer and brought the footer into the viewport. Filter changes now reset
  the actual scroller; the footer starts below the viewport and is reachable at
  the bottom. The desktop Explore rail no longer tucks under the sticky toolbar.
- Pulse: the mobile filter button extended past the right edge; 320/360px composer
  actions also overflowed. Reflow and 44px filter/tool targets corrected.
- Navigation: short-landscape drawer scrolls independently to its final links,
  contains boundary overscroll, closes with Escape and restores trigger focus.
  The feed dropdown needed its own Radix available-height bound to keep its last
  item reachable in landscape; this was a real defect, not a test-only change.
- Profile: four tabs exceeded the mobile canvas. Equal-width mobile columns now
  fit at 320/360/390; all four tabs were clicked successfully. Desktop is centered
  at 1280/2560. Mobile product details follow the gallery without three redundant
  metadata cards; gallery arrows and a pinned basket action are now available.
- Products: actual wheel testing exposed deliberate first-gesture interception
  in the shared provider. Native scrolling now drives compact chrome instead.
  Added a regression requiring the first wheel gesture to move content.
- Dashboard: desktop dock and its content padding appeared on mobile and overlapped
  the demo banner. Dock now desktop-only, with banner-aware desktop positioning.
- Warehouses: demo read used a mutation-shaped Server Action and received 403.
  Switched to the existing authenticated, role-filtered GET API. No widening of
  demo mutations. Pusher no longer reconnects on every component render. Legacy
  blank address/city fields also caused a DTO validation 500; the read contract
  now supports incomplete records and labels them unready for shipping. GET and
  refresh return 200. Shipping/write validation is not relaxed. Two unit tests pass.
- Paper trading: demo initialization hit a prohibited Server Action and crashed
  its page boundary. Demo now shows a labelled experimental/read-only state.

## Evidence and limits

- Read-only route sweep: **74 static routes at 390px**, plus **17 interview-path
  routes at 390/1280**. Screenshots cover top/middle/bottom. No uncaught JavaScript
  exceptions in either sweep. Three nested-main landmarks broke the strict audit
  locator (trading, generic confirmation, product creation); source corrected.
- These are triage captures, **not 74 fully tested features**. Some screenshots
  precede late client content; explicit readiness and interactive checks are
  needed. Admin gate denial and demo role denial do not verify owner/admin UIs.
  Dynamic record routes, actual OS keyboard, all controls, and 125% real-browser
  zoom still require additional coverage. No real-Chrome pass claimed.
- Production-mode local build and touched-file lint passed. Focused S3 marketplace
  and S7 Pulse/drawer checks passed. Native-product-scroll/profile regression
  also passed after it caught a 24px fixed-bar margin gap (corrected). The mobile
  purchase bar ends at y=844 in an 844px viewport, with the menu still visible.
- Final focused local run: **4/4** including setup in 30.4s. Production build and
  **62/62** payment/storage/warehouse unit tests passed. Paper-trading demo and
  dashboard mobile screenshots were visually reviewed after correction.
- Pulse regression uses 12 deterministic posts for repeatable geometry; real feed
  was separately scrolled and filtered interactively. Test sizes: 360×800,
  390×844, 844×390, 1280×800 and 2560×1440.
- Local free demo purchase completed in the actual UI: both separate SKUs,
  0.00 NOK receipt, real 539,906-byte JPG and 2,682-byte TXT downloads. Signed-out
  download returns 401; replay returns the same order. Demo AI allowance remains
  an unfinished S5 item; no PayPal transaction was made.
- Live free demo flow also passed: same two real file types/sizes, 0.00 NOK
  receipt, anonymous 401 and same-order replay. Final live focused regression
  **4/4 in 40.6s**, release `c965d86` / `dpl_B1DDWufH2bBHurwbhyBTF8bomUy6`.
  Actual live Pulse scroll/filter reproduction also passed (700→0; footer y=844).
- Warehouse detail **API**: anonymous 401; demo 200 with empty inventory/products,
  locally and live. Three role-isolation unit tests added. This is distinct from
  its detail page, which now also uses the secured GET DTO. Local demo detail,
  refresh and return-to-list passed at 360/390/1280/2560, with role-aware inventory
  guidance and no privileged stock controls. Legacy read action now requires an
  ADMIN/OWNER session. The new S8 regression passed (2/2 including setup).
- Product filters now use the existing focus-managed Sheet below 1024px. Closed
  content is absent from the accessibility tree; header/footer remain reachable
  in short landscape; boundary scrolling stays within the drawer; Escape restores
  trigger focus. Toolbar targets are named and 44px, and the responsive breakpoint
  matches the shell. Actual Digital Art selection/reset and visual review passed.
  Focused local S3/S7 run: **5/5 including setup in 42.9s**. Build/TypeScript and
  touched-file lint passed. Final live S3/S7/S8 **6/6 including setup in 1.0m**,
  release `6b8adc1` / `dpl_ABEFDCXREp97puGonJb9PzvkFFqp`. Live warehouse phone
  screenshot also confirmed a 44px refresh button and no horizontal overflow.
- Ignored evidence directory: `frontend/.private-showcase/responsive-audit/`
  (`core-local`, `all-local`). Never commit storageState, private URLs or tokens.
- Lab timings are diagnostic only, not field Speed Insights or a claimed Core
  Web Vitals pass. Test/automation traffic is not genuine visitor telemetry.

## Remaining audit queue (not passes)

Latest local S5 candidate: model Sheet scroll boundaries, Escape/focus restoration,
conversation/settings/participant drawers, transcript wheel scrolling and pinned
composer passed at 360×800, 390×844, 844×390, 768×1024, 1024×768, 1280×800,
1920×1080 and 2560×1440. No horizontal page overflow. Outer-page auto-scroll and
duplicate header-height allocation were corrected. This is Playwright viewport
emulation, not a claim about a physical mobile keyboard or real Chrome zoom.
The Pulse/footer/independent-navigation regression was rerun and passed locally.
Release `cd99962` subsequently passed the same live checks: real provider
debit/persistence/denial **2/2**, non-spending layout/catalog regressions **6/6**.

### Settings and wallets follow-up

- Reproduced Settings' phone navigation taking more than a viewport before the
  selected panel appeared. Replaced it with an accessible Sheet; desktop retains
  a sticky, independently scrollable rail. Section changes reset the content
  scroller, preserve URL state and restore trigger focus on drawer dismissal.
- Reproduced an uncaught server-action error and permanent loading spinner in
  demo payment settings. Demo now shows an explicit read-only payout preview.
  Normal users get caught request errors/retry, labelled 44px/16px email controls,
  wrapping actions and confirmation before removing payout details.
- Wallet chooser now fits short landscape with contained scrolling and 44px close
  control. Undetected extensions are disabled, cancellation has a human inline
  message, and an unconfigured QR path has explicit guidance. Demo linking and
  payout mutations stay denied on the server.
- Local production focused browser **3/3** in 12.3s including setup: settings
  navigation at eight sizes, actual drawer/rail/page wheel scrolling, footer,
  payout preview, and injected test-wallet cancellation/connect/disconnect while
  preserving the demo session. The fixture has no private key and cannot sign or
  send transactions. This is not owner-wallet or on-chain verification.
- All 12 Settings sections rendered at 390px without a page exception or horizontal
  page overflow. This is read/render coverage, not proof that every save action
  works. Configured WalletConnect opened and escaped locally without an exception;
  its provider-owned wallet buttons and owner consent are not fully audited.
- Payout ownership/demo guards and project-ID configuration: **30/30** focused
  unit tests including demo policy. Local screenshots visually compared portrait
  and short landscape. Initial release `050a407` passed five live checks but
  failed one: opening Settings moved the background 112px. A manual attempt
  reproduced the intermittent jump. Removed Settings' entrance transform/fade
  and explicitly focused the drawer close button without scrolling; regression
  now checks the background immediately on opening as well as after scrolling.
  Corrected release `d2c9bdf` passed three consecutive fresh-context Settings runs
  locally **4/4** (40.7s) and live **4/4** (37.2s), including setup. The earlier
  live run also passed injected-wallet cancellation/connect/disconnect, AI reflow,
  Pulse/footer and the marketplace flow. Native owner-wallet actions remain open.

- Products: continue full keyboard traversal and seller-row target-size review.
  Drawer focus/scroll, category selection, search/empty state and gallery arrows
  have focused coverage; this does not verify every filtering combination.
- Pulse action controls, notifications and experimental polls: inspect accessible
  names in the actual accessibility tree. The raw button scanner over-counts
  controls named by associated labels (for example filter checkboxes).
- Analytics, company creation and jobs posting: demo permissions produce access
  denials. Replace raw/unhelpful error states where needed without allowing writes.
- Dynamic company/warehouse/order/download pages need seeded-record flows, not
  placeholder IDs. Paid seller view still needs owner/payment evidence.
- Warehouse owner/admin inventory mutation still needs a privileged session and
  safe test inventory. USER/demo read success does not verify stock updates.
- Actual Chrome, physical keyboard/safe-area behavior and 125% browser zoom remain
  unverified after the PC crash. No connected Chrome surface is available yet.

## Messages follow-up (local/live verified)

- Phone/landscape inspection found unassociated labels, 14px form text, nested
  link/button markup, and errors visible only in the console. Candidate uses
  16px labelled controls, a constrained form, wrapping toolbar, draft-preserving
  errors, abortable search, and explicit non-sending demo preview.
- First focused browser run caught a real scroll failure: `/conversations/new`
  matched the shell's immersive transcript rule, leaving no usable page scroller.
  Excluded the creation form from that rule. One additional failure was an overly
  broad test alert locator matching Next's route announcer; narrowed to the form.
  Corrected production build/TypeScript and touched lint pass. Local focused
  browser **3/3** (9.2s including setup): eight viewport sizes with actual wheel
  scrolling, demo write prevention, labelled 16px/48px fields, keyboard recipient
  selection and draft retention after a mocked failure. Portrait and short-
  landscape lower scroll boundaries were visually reviewed. Shell regressions
  **4/4** (42.5s) also pass locally. Release `8a410a5` /
  `dpl_CSfnTPogxR24AfB47kgKeTkDa2Wh` passed **6/6** live (58.8s), combining both
  Messages checks with Settings, AI and Pulse/footer. Live phone visual review passed.
- Normal-account error tests intercept user search and conversation creation;
  they are UI resilience tests, not real delivery to another user. No real-member
  messages are sent by this audit.

### Homepage speed baseline (not a performance pass)

- Read-only cold-context samples, 390×844, CDP 4× CPU slowdown and 1.6 Mbps /
  150ms network. Hero readiness is the first visible Browse products link; this
  is not a Lighthouse score or field Core Web Vitals measurement.
- Local production: interim LCP 10,488ms, FCP 1,876ms, CLS 0; about 1.52MB resource
  transfer by readiness. Live release `4c85955`: interim LCP 11,644ms, FCP 5,248ms,
  CLS 0; about 1.33MB resource transfer by readiness. One unthrottled local sample
  had LCP 1,088ms. These are single diagnostic samples, not reliable percentiles.
- Code inspection confirms the whole app waits behind a client-only dynamic
  wallet provider, and ActiveNetworkProvider renders null until local storage is
  loaded. The comment saying wallets do not block initial paint is inaccurate.
  Profile/refactor this boundary without remounting the shell, breaking wallet
  state, or replacing content with a fresh skeleton on navigation.

### First-render correction (local/live verified)

- Keep the provider tree mounted but allow server rendering; network preferences
  no longer return a blank subtree. Restore browser preferences after the matching
  first render. Wallet/network synchronization waits for preference hydration,
  so an initial default must not request the wrong chain. Reconnect/permissions
  and signing behavior remain unchanged.
- Added a semantic homepage heading and removed delayed title/chat-panel entrance
  animation. Hover effects and user-triggered open/close transitions remain.
- Early candidate monitoring initially looked fast, but a full observation caught
  the still-transparent chat panel becoming the largest paint at 15,588ms. Fixed
  its initial animation rather than reporting the misleading early measurement.
- Corrected local sample at 390×844, 4× CPU, 1.6 Mbps/150ms, cold context and 20s
  observation: LCP **2,564ms**, FCP **1,852ms**, CLS **0**; second cold-context
  sample LCP **2,624ms**, FCP **1,884ms**, CLS **0**. Before deployment, the
  same 20s observation on live `8a410a5` returned LCP **14,700ms**, FCP **4,524ms**,
  CLS **0**. These are lab diagnostics, not field percentiles, and local/live
  network/bundlers differ. JavaScript transfer/interactive readiness remain work.
- Verification blocks external app scripts but permits Next's inline streaming
  reveal. Hero and chat intro must actually be visible, including nonzero ancestor
  opacity. This is not a claim of full no-JavaScript support. An earlier test with
  all JavaScript disabled correctly left streamed HTML hidden; refined the test
  to the intended pre-hydration-paint contract. Shell retention is checked after
  a successful client interaction, not an early native-link page navigation.
- Provider/config/event units **8/8**, production build/TypeScript/touched lint
  pass. Initial provider candidate core route regression **8/8** (1.1m): Settings,
  AI, Messages, warehouses, product filters, Pulse/footer, cart. Final paint
  candidate focused **5/5** (23.4s): pre-bundle paint, stored preference hydration,
  injected-wallet lifecycle and AI. Release `2778cb2` /
  `dpl_CyqBXU5FnH83fPpf5P3dihaWBThL` is READY. Live regressions **7/7** (49.3s)
  include pre-bundle visibility, reduced-motion hydration, wallet lifecycle,
  AI, Messages and Pulse/footer/drawer scrolling. Two same-host 20s observations
  after release: LCP **7,528 / 6,044ms**, FCP **6,632 / 5,168ms**, CLS **0**.
  Old-live settled LCP was 14,700ms. Remaining server/network delay and roughly
  1.66MB resource transfer mean this is improvement, not a performance pass.

### Companies follow-up (local/live verified)

- Directory: preserved heading and cached public results across auth resolution;
  independent account-company reads, explicit retry, matching card skeletons,
  responsive one/two/three/four-column grid and a centered 1280px canvas. Demo
  onboarding is compact and links to a non-writing setup preview.
- Storefront: corrected hardcoded dollar prices to the stored currency, filtered
  the database relation to PUBLIC products, removed a misleading 70%-of-views
  “unique visitor” estimate and unmeasured sales chart. Recorded views/reviews
  now render as an accessible server-side summary without a chart bundle.
  Added image sizes, a back link, theme tokens and consistent mobile gutters.
- Setup: demo/anonymous sessions do not mount the uploading form. Added a
  server-action demo denial as defense in depth. Normal form waits for its action,
  retains drafts on errors, uses 16px/48px controls and a safe-area submit footer.
  Only ADMIN requests the admin-only user directory; payload logging removed.
- Local production build/TypeScript/touched lint pass; **25/25** focused units.
  Company browser checks **4/4** (11.4s), plus expanded form reflow **2/2** (5.5s).
  Actual wheel scrolling at 360/390/short landscape/768/1024/1280/1920/2560,
  storefront-to-PDP links, NOK prices, demo guard, error retry and heading retention
  verified. Phone top/bottom visuals show the footer after content, not over it.
- First build caught an optional-description type mismatch, corrected. Initial
  retry test omitted auth and correctly redirected to login; supplied the existing
  demo session without changing route protection. Normal submit error test changes
  only client fixture identity and intercepts the entire write: no real company,
  employee invitation or upload is performed. Owner company creation remains a
  separate feature test, not proven by this mocked failure. Release `e6dcb6f` /
  `dpl_6a76C651Gpg4NWBXmZjB2xBh6wPb` is READY. Live company regressions plus
  Pulse/footer/drawer test **5/5** (37.5s), followed by live phone visual review.
  Local company-page navigation drawer was additionally wheel-scrolled to its
  boundary at 844×390: background stayed at 0 and Escape restored trigger focus.

### Navigation discoverability and optional UI loading (local/live verified after follow-up)

- Phones now show an explicit 44px Menu button instead of an unlabeled-looking
  profile image as the sole navigation cue. Desktop avatar remains. Drawer aria
  name, focus restoration, connection providers and sessions are unchanged.
- Sidebar wallet/verification/list UIs are separate lazy chunks, mounted only
  inside the open sheet. Removed the OAuth bridge's email console output.
- Production build/TypeScript/touched lint pass. Local focused browser **8/8**
  (50.4s): Settings, injected wallet, pre-bundle paint, reduced-motion hydration,
  Companies, Pulse/footer/drawer and marketplace/cart. Mobile visual review passed.
- Local source-to-chunk check confirms the wallet panel chunk was absent before
  opening the menu and requested afterward (about 29KB transferred). Other menu
  requests include link prefetches; do not attribute all of them to the wallet.
  Cold-context 20s sample: LCP 2,708ms, FCP 1,896ms, CLS 0, transfer 1,985,129 bytes.
  That is roughly unchanged versus earlier local paint samples, not a claimed
  major speed gain. Remaining live trace shows CSS/font and shared-script download
  competition; the wallet core is still global. Release `cc9e5db` /
  `dpl_DybY1nKVmdXPn3BP4TBP1fXubhtY` is READY, but live verification returned
  **7 pass / 1 fail**: reduced-motion hydration failed, reproduced **3/3**.
  The follow-up below resolves that regression; the failed run remains recorded.

### Reduced-motion hydration regression (local/live verified)

- A fresh live browser reproduced React #418 with reduced motion even without
  stored wallet preferences; normal motion did not reproduce it. Webpack dev's
  detailed error identifies `KineticHeadline`: the server rendered letter spans,
  while the initial browser render returned plain text. The topbar also had
  preference-dependent initial style differences. Turbopack-only verification
  had missed this bundler-sensitive initialization order.
- Keep hero title/headline/description markup and geometry identical in both
  preferences. Disable hover/orb effects instead of replacing text elements.
  A `useSyncExternalStore` motion hook uses the same snapshot on server and first
  browser render, then subscribes to real OS changes. No hydration-warning
  suppression, accessibility opt-out or client-only shell workaround.
- Focused hook/provider units **5/5** and touched-file lint pass. Added browser
  checks for heading retention/geometry across live motion-preference changes.
  The first local production candidate still failed both viewport checks because
  `BelowFoldSections` repeated the plain-text/letter-span branch. Applied the same
  stable structure there; the release was not deployed after the failed check.
  Final Webpack build/TypeScript passes; repeated local browser checks **10/10**
  (19.2s): pre-bundle paint plus 390/1280px hydration/geometry/shell retention,
  each repeated three times. Live combined verification passes in the footer
  follow-up release below; additional repeated live checks are recorded there.

### Findings from the next route pass

- Real `/pulse` feed scrolling (390px, retained demo, no response fixture) exposed
  a gap missed by the finite-feed regression: after the first 30 posts, fetching
  the next page expands scroll height from about 8,920 to 17,345px. At the next
  boundary the global footer is visible alongside the pagination spinner, then
  moves down as more posts arrive. Suppress that provisional footer until the
  feed reaches its real end; add a delayed-pagination regression, not only a
  finite fixture. Cards/toolbar stayed within the 390px canvas. Existing system
  posts also display raw Markdown `**` around their deployment titles.
- `/analytics`: actual phone navigation exposes raw Markdown asterisks, large
  center-aligned introductory filler and undersized category links. Product
  analytics reaches the intended API, which correctly returns 403 for the demo
  USER, but UI labels it a generic load failure with no recovery/role guidance.
  Do not weaken the ADMIN-only endpoint to fix this presentation defect.
- Analytics chart loading/error states vertically recenter the whole page rather
  than keeping header and chart geometry stable. Crypto adds a second footer and
  an inconsistent width system. Continue actual interval/date/scroll checks after
  role-aware presentation is corrected; static-route smoke was not sufficient.
- Root AppProviders receives no initial server session. On hard navigation,
  signed-in demo notice arrives after client auth resolves. The initial analytics
  screenshot preceded that state; settled screenshot was inspected separately.
  A subsequent signed-in cold-context 20s diagnostic on `/analytics` (390px,
  4× CPU, 1.6Mbps/150ms) recorded CLS 0, so no measurable shift is established by
  that run. Continue verifying readiness and session initialization rather than
  treating the initial screenshot or a single metric as proof of stable loading.

### Pulse pagination footer follow-up (local/live verified)

- Scoped footer visibility to the feed's real pagination boundary: no provisional
  footer while loading, when another cursor exists, or while a failed batch needs
  retry. No scroll-event polling, fixed-position overlay or footer remount loop.
- Check HTTP/schema failures before treating a response as an empty final page.
  Preserve loaded posts on pagination failures, show explicit retry, and stop
  automatic retry loops. Superseded requests are aborted so an earlier filter
  cannot overwrite the current result. Empty filtered batches offer an explicit
  check-more action rather than trapping the cursor behind a missing sentinel.
- Added delayed-success/503/retry/true-end browser fixtures at 390 and 1280px.
  The new 390px test failed on the pre-fix build because its footer stayed visible,
  proving the regression covers the real-feed issue missed by finite fixtures.
- Actual reduced-motion lower-homepage scrolling also exposed delayed opacity
  entrances. Removed initial hiding from essential below-fold sections while
  preserving hover effects; pre-bundle test now scrolls to a lower heading and
  checks ancestor opacity. That test also exposed letter-by-letter accessible
  names (`T h r e e …`): added one semantic text copy and hid decorative glyphs
  from assistive technology in the lower headings, hero description and kicker.
- Initial combined run **6 pass / 4 fail**: one real accessible-name defect,
  two new pagination assertions targeted a non-rendered title (the cards display
  their description), and a wallet-dialog wheel stopped 3px before its settled
  bottom. Pagination checks now assert visible articles/counts; wallet test waits
  for opening animation and continues actual wheel gestures without relaxing its
  <2px bottom threshold. Targeted rerun **4/4** (16.2s): Settings plus both
  pagination viewports. Final Webpack build/TypeScript/touched lint pass; combined
  local browser run **10/10** (47.4s): Settings, injected wallet, early paint,
  390/1280px reduced-motion hydration, finite-feed/drawer scrolling, paginated
  feed retry/scroll preservation/footer and marketplace/cart. Actual phone
  screenshots confirm lower sections are readable immediately, accessible
  headings read whole words, and the real feed keeps its footer hidden while
  more posts remain. Release `3a8f0cc` / `dpl_B8hWfk6B1Pfw1BBArndAeL2P1Mg9`
  is READY at www.veggat.com. The same live regression is **10/10** (1.1m).
  Extra live reduced-motion repetitions are **7/7** (16.2s, setup plus three
  runs at each of 390/1280px), with no hydration errors.
  Actual live phone scrolling independently confirmed hidden pending footer,
  no horizontal overflow/JS exceptions, and Polls reset from deep scroll to 0.
  Its new check-more button successfully loaded real poll cards after an empty
  filtered batch. Existing legacy Markdown/confidence copy remains editorial
  backlog, not changed during the layout correction.
- Real Chrome connector was checked again: its inventory still returned no apps
  or browsers. These tests use the explicitly authorized Playwright browser, not
  the owner's real Chrome session.

### Analytics growth and publishing mix (local/live verified)

- Replaced the centered filler/error pages with the existing token-based, bounded
  page shell: 16/24/32px gutters, 1280px maximum canvas, labelled report cards,
  consistent back navigation and 48px / 16px date controls. Growth previews are
  explicitly fictional January–March 2026 data, not fabricated platform KPIs.
  Non-admin visitors no longer send doomed private analytics requests. The APIs
  still enforce authentication, ADMIN role and rate limits before querying data.
- Lazy chart renderer, geometry-matched loading placeholders, fixed UTC date
  ranges, inline invalid-range errors, text totals and a keyboard-accessible
  bounded data table. Table overscroll does not move the page behind it.
  Admin data is user-keyed/cached, schema-validated and manually refreshable;
  failures retain the header and explicitly identify any stale displayed report.
- Fixed a real backend date bug: starting daily iteration at the first record's
  time-of-day could omit today. UTC-midnight iteration now includes today even
  across DST, and the 10,000-record cohort has deterministic creation/id ordering.
  The cap and the distinction between creation counts and revenue are disclosed.
- Focused units **16/16**, touched-file lint and final Webpack/TypeScript pass.
  Final local browser **5/5** (16.5s, including setup): each growth report,
  filtering, invalid/empty/single-day ranges, actual nested table/page/footer and
  drawer scrolling, keyboard return focus, admin fixture retry/stale report,
  and real demo API 403. All eight specified viewport sizes have no horizontal
  page overflow. Admin UI tests intercept browser responses only: they do not
  promote the real demo user or claim a real administrator database session.
- Initial release `c929ec7` / `dpl_EJDBb1jcJMvMr94tWtCKKzo19Di3` is READY at
  www.veggat.com; its live regression was **5/5** (21.3s including setup).
  Further actual live scrolling on Users exposed a legacy second chart with its
  own H1, incompatible full-width container and unrestricted platform-count API.
  The first regression missed it: it focused on the new growth chart. Expanded
  coverage now checks the entire page's title count, both sections' alignment,
  every private analytics request, and wheel scrolling at every target size.
  It fails on the pre-follow-up build, proving that this gap is covered.
- Follow-up: compose the existing publishing section inside the shared shell;
  use a labelled, fictional preview for non-admins and readable counts rather
  than another oversized chart. Enforce ADMIN/auth/rate limits on its API and
  use database counts instead of loading all product/user IDs. Explicit retry,
  validation and a user-scoped cache match the growth reports. Units **20/20**.
  Final local follow-up build/TypeScript/lint pass; expanded browser **5/5**
  (23.6s). Real local demo mix request returns 403; lower-page visual alignment
  and a single H1 were independently confirmed in the interactive browser.
- Follow-up `10c00ad` / `dpl_FmYLPXbffVtaGYQAGTmSGpsPXTtc` is READY at
  www.veggat.com. Expanded live browser **5/5** (34.2s including setup), with
  all three reports scrolled at all eight sizes, and admin growth/mix recovery
  tested using browser-only fixtures. Actual live requests to all four endpoints
  return 401 anonymously; the real demo publishing-mix request returns 403.
  Settled live phone inspection shows aligned sections, one H1, no horizontal
  overflow or JavaScript exceptions. Skeleton and settled states were inspected
  separately; a region's presence alone is not a data-readiness assertion.
- Remaining: Crypto is covered in the next entry. Real Chrome/OS zoom and
  real-phone keyboard checks remain unverified. The whole app audit is PARTIAL.

### Crypto price history (local/live verified)

- Actual browser reproduction found two footers, unlabelled 40px selectors,
  incompatible page spacing and a large, fixed-height chart. Reused AnalyticsShell
  and existing tokens: one heading/footer, bounded canvas, labelled 48px controls,
  two-column phone/four-column desktop filter grid and a stable chart placeholder.
  Lazy, non-animated canvas has a text summary and paginated, keyboard-accessible
  table; its scroll boundary does not move the background. Light/dark and real
  360px / 2560px screenshots were inspected, not only geometry assertions.
- Date ranges filter the canonical daily history locally. Weekly means use UTC
  Mondays; monthly means use calendar months rather than 30-day slices. Partial
  periods, historical rather than live prices, provider retrieval time and hourly
  caching are disclosed. Empty, invalid, delayed and stale/error states retain
  the page chrome. Asset/currency keys prevent late data relabelling.
- Both current and legacy endpoints now share strict coin/currency/date allowlists,
  rate limiting, a ten-second upstream timeout, bounded response validation and
  redacted 503 errors. Nine canonical coin/currency pairs share validated hourly
  server caching; user dates do not create additional upstream cache entries.
  Existing Pro keys stay in headers; optional Demo keys use a separate documented
  variable. No key, billing setting, or environment value was changed.
- Actual local requests: Ethereum USD/EUR/NOK, Bitcoin USD and WPLS USD all 200
  with 365 daily values. Seven-day and legacy monthly requests reused the same
  Ethereum retrieval timestamp (7 observations / 13 calendar periods). This
  verifies availability/caching, not independent accuracy of market prices.
- Focused analytics units **38/38**, touched-file lint and initial Webpack build /
  TypeScript pass. Initial Crypto browser run: **2 pass / 3 fail**, including setup.
  Failures came from interacting with inert server-rendered controls before shell
  hydration; tests now wait for the first actual client request before interacting
  or measuring its loading placeholder. No fixed sleep was added. Expanded local
  Crypto + growth regression **9/9** (34.4s): retries, empty/zero/malformed data,
  filter changes without refetches, reversed/cleared dates, data pagination, late
  responses, drawer focus, table and page/footer wheel scrolling at eight sizes.
- Real Chrome inventory was checked again and remains empty. This evidence uses
  the explicitly authorized Playwright browser, not the owner's Chrome session.
  Browser zoom and a physical phone keyboard remain separate, unverified checks.
- Final small-value axis formatting/light-theme contrast build and TypeScript
  pass. Settled phone inspection caught touching date labels; added axis label
  spacing, rebuilt and visually verified distinct dates. Final targeted Crypto
  regression **5/5** (15.7s); preceding combined analytics regression **9/9**
  (34.8s).
- Release `6f9a804` / `dpl_F8CpxqRgrmtkZENRUpszL8dMKVz3` is READY at
  www.veggat.com. Combined live analytics regression **9/9** (44.9s), including
  setup. Actual live Ethereum USD/EUR/NOK, Bitcoin USD and WPLS USD requests
  all return 200 with 365 observations; short-range and legacy monthly requests
  reuse the same retrieval time. Real phone chart/table/footer and 2560px canvas
  inspected: one footer, contained table scrolling, no horizontal page overflow
  and no JavaScript exceptions. Browser fixtures independently test failures;
  they are not the evidence for provider availability. Private screenshots:
  `.private-showcase/responsive-audit/crypto-live-{phone-table,phone-footer,wide}.png`.
- Next-route triage: Pricing's “Manage API keys” link actually lands on the
  Profile panel (`/settings#ai-keys`); Settings expects `?section=ai`. Confirmed
  through the visible button in the real local app, not just source inspection.
  Its contact CTA also reaches `/info#contact` without a matching anchor. Actual
  bottom scrolling finds a Contact section but no nearby contact action; the only
  GitHub link is above it. These are queued defects, not verified fixes.

### Pricing and Info/contact (local/live verified; follow-up findings retained)

- Reproduced Pricing's API-key CTA opening Profile instead of AI Keys, and its
  contact CTA targeting a nonexistent fragment. Added focused regressions before
  the fix: the link test failed on the wrong URL and a separate pre-bundle test
  proved Info's heading stayed transparent when external app chunks were blocked.
- Info is now server-rendered, with a short marketplace story, a concrete free
  demo walkthrough, architecture boundaries and clearly experimental modules.
  Removed the placeholder email and linked GitHub directly from a named Contact
  section. Existing tokens and 16/24/32px gutters / 1280px canvas retained; cards
  stack on phones. Removed delayed text entrances, perpetual blur/glow loops and
  route-specific Framer Motion hydration. Avatar feedback is a 200ms transform
  only on hover-capable pointers, disabled under reduced motion.
- Pricing now uses the same gutters/canvas, a smaller phone heading, a 44px
  contact link and explicit focus styles. Its key link uses `?section=ai` and the
  existing auth redirect preserves that destination. FAQ no longer promises six
  selectable key providers: the legacy Settings panel currently exposes three,
  despite six server-supported providers. Completing that management UI remains
  a separate follow-up, not a finished feature.
- Initial candidate build/TypeScript/lint passed. New pre-bundle/reduced-motion
  and signed-out callback tests pass. The complete links test fails at both
  390/1280: the shared nested scroller resets a valid contact destination to 0.
  Actual browser reproduction confirms Contact remains below the viewport.
  An immediate anchor lookup still failed: instrumented browser calls showed
  that both Next's scroll and the shell reset run before Contact mounts. The
  correction now uses bounded observation for a delayed fragment, disconnects
  when found, and cancels on user wheel/touch/pointer/keyboard input or navigation.
  Missing/malformed fragments cannot crash or retain a permanent observer.
  **9/9** focused unit tests and touched-file lint pass. Pulse regressions passed
  on the intermediate candidate; contact/reload and the final shared-scroll
  correction still require the final local/live browser run.
- The delayed target test exposed a second, visible defect: `scrollIntoView`
  moved the document by 253px, hiding the demo notice and leaving a blank strip
  below the footer. An isolated browser experiment confirmed root `overflow:
  clip` alone did not prevent this viewport jump. The application shell is now
  explicitly viewport-bound (`h-dvh`), with only the existing page and drawer
  scrollers moving. The gate is outside that shell and keeps its normal layout.
  New assertions check document scroll stays zero, the demo notice stays visible
  and the page scroller ends at the viewport after links, reload and footer scroll.
- Expanded intermediate browser run: **13/15** passed, including Products,
  Settings, AI, Messages, hydration and all three Pulse checks. The two failures
  were direct Contact reloads, not the corrected client navigation. On initial
  load the parent's layout effect ran before lazy providers mounted its scroller.
  Restoration now lives in a small child component next to the actual DOM node;
  this preserves the existing shell and Pulse modal scroll key. Direct phone
  reload now reaches Contact with document scroll 0; full final verification
  remains pending.
- A dedicated delayed-script test reproduced an initial-load race: scroll to
  Pricing's lower key-management link before app bundles arrive, then hydrate;
  the initial route reset pulled it out of view. This is distinct from a route
  change and could lose an early click. The scroller now resets ordinary pages
  only when the pathname changes, preserving pre-hydration user scroll; explicit
  fragments still restore on initial load. The regression failed on the prior
  production candidate and is included in final verification.
- This slice does not claim payment availability, completed OAuth consent, real
  Chrome access, physical keyboard behavior or a field Core Web Vitals pass.
- Final production build/TypeScript/touched-file lint pass; scroll-helper units
  **9/9**. Final local browser batch **16/16** (1.6m, including setup) passes:
  Pricing/Info links, preserved auth callback, cross-route/in-page/reloaded
  Contact, delayed-script scroll preservation, readable pre-bundle text, all
  eight viewport sizes, real wheel/footer/drawer scrolling and shared Products,
  Settings, AI, Messages, hydration and Pulse regressions. No provider generation,
  key mutation, new demo grants or purchases were made in this slice.
  Phone dark/light, short landscape and centered 2560px visuals were inspected.
  Additional manual checks: Register's submit remains reachable at 390x360 and
  the keyboard skip link focuses main without moving the document. This is a
  shortened-viewport check, not a physical phone-keyboard verification.
- Follow-up source findings to verify visually: login/register still use 500ms
  opacity entrances, fixed theme buttons and the older Pulse-first product copy.
  Register's only H1 is hidden below `lg`; the form title is an H2. Products also
  lacks a semantic page H1. These are queued separately from Pricing/Info, not
  counted as fixed by this slice.
- Release `69b28f5` / `dpl_FPtEEKqcze5djFprwV1QLvTSxUW3` is READY at
  www.veggat.com. First live batch **15/16**: all new Pricing/Info tests and
  Pulse regressions passed, but Product filters recorded an 11px background
  difference between pre-click and post-wheel samples. Manual tracing found
  movement around the click, not the wheel gestures. Three unchanged repeats
  then passed. The test now records pointer-down separately and independently
  requires no movement on drawer opening or wheel scrolling. Five instrumented
  live repetitions (**6/6** with setup, 40.7s) recorded 0 -> 0 -> 0 at all three
  sizes; local counterpart **2/2** (9.4s). This does not conclusively explain the
  original intermittent movement, which remains tracked for the Products audit.
  Final combined live verification **16/16** (1.7m, including setup) passes on
  the same release. Phone Contact reload/footer and ultrawide Pricing visuals
  were inspected; document scroll stays 0, the demo notice remains visible and
  the 1280px canvas is centered at 2560px. Private screenshots are retained in
  `.private-showcase/responsive-audit/`; they are excluded from deployment/git.
- Visual follow-up: Pricing's middle price starts 20px above the other cards
  because descriptions wrap differently. A browser-only subgrid experiment
  aligned all three prices; that refinement is not yet in source or deployed.

## Auth first paint, forms and alignment follow-up

- Reproduced: login's FormControl wrapped a div rather than the input. Both
  email/password inputs had zero associated labels and 14px text. Register had
  no visible mobile H1, slow opacity entrances and a fixed theme control near
  the title. Recovery cards could shrink/align left inside a nested scroller.
- Login/register now share a bounded 1280px canvas, 448px form column, normal-flow
  44px theme/navigation controls, marketplace-first copy and one visible H1.
  Provider names remain visible on phones. Fields are 48px with 16px text,
  proper labels and autocomplete; 2FA accepts the emailed one-time code.
- Removed signup's pre-auth avatar uploader: EdgeStore correctly denies anonymous
  uploads. Existing authenticated Settings handles avatars. Removed the obsolete
  cross-tab verification redirect/listener and its inaccurate auto-redirect copy.
- Async transitions now await login/reset/new-password actions. Pending controls
  stay disabled; transport failures show recoverable errors without logging form
  data. Server validation, throttling, callback filtering and token/2FA checks
  were not relaxed.
- Browser testing found an additional hydration race: an early reset-email fill
  could be replaced by the controlled form's empty initial value. A shared
  readiness hook keeps JS-dependent inputs/buttons disabled until handlers attach.
  Labels and fields still render immediately; tests hold scripts, then release
  them and verify input retention. This also protects demo/provider buttons.
- Auth search params previously caused a root client-rendering fallback, leaving
  only "Loading page" without app bundles. Auth's request-rendered layout now
  delivers the actual form HTML. Blocked-bundle tests cover login/register/reset
  with normal and reduced motion. No field can accept an early, discarded edit.
- Auth hides the main topbar, but its default 72px offset still shortened main.
  The auth shell now sets the inherited offset to zero before hydration. Footer
  starts below the viewport; real wheel scrolling reaches it without moving the
  document. Phone dark/light recovery and ultrawide account layouts were inspected.
- Pricing cards now share subgrid rows at tablet/desktop widths. Consistent CTA
  borders remove the remaining 2px baseline mismatch. Tests compare price and
  action positions at 768/1024/1280/1920/2560, not only page overflow.
- Test corrections: Next's route announcer is also an alert, so transport-error
  assertions are scoped to the form. `/auth` preserves its callback query, and
  `/auth/security-action` is protected, not an anonymous recovery screen. The
  latter's signed-in missing-token state was checked with the retained local
  demo at 390/1280; no security action was performed.
- Final local batch: **18/18** (1.5m, including setup), covering the eight-size
  auth audit, first paint, delayed hydration, four transport failures, actual
  register/verify/reset/replay/session revocation/login/logout/2FA, Pricing/Info,
  Pulse pagination/drawer/footer regressions and the catalogue/cart flow.
  **30/30** focused unit tests, touched-file lint and Webpack production build
  pass. Local first-attempt failures and their fixes are documented above rather
  than treated as passes. Added demo-denial regression **2/2** locally: exact URL
  pathname matching intercepts Auth.js's trailing `?` and asserts no session was
  created. The earlier manual glob missed that delimiter, so it exercised a real
  successful demo sign-in instead; one isolated local demo was created normally
  and retained privately. No cap/balance reset or AI generation occurred.
- Production release `2c143df` / `dpl_53ubXcvth4nMahFFNGG73tejaCLa` is READY
  at www.veggat.com. Live batch **18/19** (2.3m): the layout test missed the late
  cookie banner and wheeled over that overlay. It now waits for actual consent
  readiness before dismissing it. Two complete eight-viewport auth audit repeats
  then pass (**3/3** with setup, 39.7s), so all targeted cases have passed on the
  unchanged release. Full live recovery/2FA, pricing alignment, delayed scripts,
  transport errors, demo-denial, Pulse and catalogue/cart checks passed.
- Google, GitHub and Discord buttons reach each provider's own sign-in page both
  locally and live. Full owner OAuth consent/callback is still not claimed.
  Live phone and 2560px visuals were inspected: 1280px canvas centered at x=640,
  footer begins at y=1440 before scrolling. Phone recovery footer was reached by
  a real wheel event, with the document remaining at scrollY=0. Owner Chrome's
  connector still reports `apps: [], browsers: []`; this is Playwright evidence.
  Physical phone keyboard behavior and real browser 125% zoom remain unverified.

## Products follow-up — stable catalog and filter boundaries

- Observed the original 50px wheel gesture settle at 10px because the product
  heading collapsed and browser scroll anchoring pulled the content back. The
  toolbar also inserted controls after scrolling, changing the search width.
  Both now have stable geometry, a real H1, a bounded 1280px canvas and 16/24/32px
  gutters. The footer remains absent on this catalog route by design.
- Replaced hover-only metadata, 10–11px text and oversized portrait cards with
  readable, container-responsive 1/2/3/4-column cards, stable 4:3 media and native
  product links. Mobile gallery arrows are visible 44px controls. Listing prices
  display their actual currency (29/39 NOK for the reviewer SKUs); malformed
  currency data displays an unavailable state and disables purchase controls.
- Initial route/data skeletons share final card geometry. Existing results stay
  visible while filters refresh. Search cancellation is immediate, requests time
  out after 15 seconds, and explicit retry preserves the failed page number.
  Load-more is explicit; there are no orphan automatic retries or skipped pages.
- Categories use the existing keyboard-accessible menu primitive. Desktop filter
  positions reserve space at all four docks, not just screen edges; mobile filters
  remain a focus-trapped sheet. Panel position/size no longer morph while scrolling.
  Removed per-scroll React progress updates and decorative catalog particles.
  Slider targets/edit fields are 44px/16px and track sizing follows ResizeObserver.
- The audit found a data mismatch: categories, sellers and price bounds counted
  hidden/unavailable listings while the catalog excluded them. Shared public
  visibility/availability criteria now apply to every facet query, including
  combinations of search/seller/category filters. Price bounds use one query.
- Touched-file lint and **21/21** focused unit tests pass. First browser batch
  **4/6**: one test wheeled before cookie-overlay exit, and another used an
  incorrect retained-session file path. After fixing test readiness/path, **6/6**
  passed (27.0s), including the eight requested viewport sizes, exact first-wheel
  movement, no horizontal page overflow, drawer boundaries/focus, all four desktop
  docks, real image navigation, matching skeleton height and intercepted stale/
  failed/empty responses. Final production build/TypeScript and expanded local
  browser regression **11/11** pass (56.6s), including malformed-currency safety,
  persisted right-dock reload with no hydration errors, PDP/profile scrolling,
  Pulse/footer pagination/retry and the real demo catalog/cart flow. Added direct
  catalog Add-to-cart/Buy-now and transport-failure recovery pass locally **2/2**
  with setup (10.9s); no checkout submission, payment or credit grant was made.
- Production release `e11500c` / `dpl_4DAXWppTxnFvTWPwh1so2XPYYYW3` is READY at
  www.veggat.com. Complete live batch **12/12** passes (1.3m), including those
  purchase-button checks. Live public metadata now correctly reports the two
  available categories and 29–39 NOK price bounds. Phone dark/light and landscape
  visuals were inspected locally; live phone/dark/landscape/ultrawide inspected.
  At 2560px the canvas is 1280px centered at x=640. Actual landscape filter wheel
  scrolling reaches 512px while the background remains at 0, with no JS errors.
- Limits: this is not a field Core Web Vitals claim. Physical phone keyboard and
  owner Chrome/125% zoom remain unverified: the connection inventory again
  reports `apps: [], browsers: []`. Owner/payment-provider secrets and full-route
  feature work elsewhere remain tracked separately; no live payment or new
  AI credit grant was made during this catalog slice.

## Cart follow-up — readable rows and uncertain update recovery

- Reconfirmed Pulse with actual wheel input: the first 60px gesture remains at
  60px, footer hidden while pagination remains. At 844×390 the navigation drawer
  reaches its 752px scroll boundary while the background remains at 60px. Escape
  restores Menu focus. An initial manual wheel used pre-animation coordinates;
  observing the settled drawer and retrying reached the expected boundary.
- `frontend/app/cart/page.tsx`: the old 390px layout squeezed both titles to
  roughly 120px beside quantity controls. Rows now wrap titles, put 44px quantity
  and removal controls on a separate line, provide native product links, and
  use correctly sized 80/96px thumbnails. The 1280px canvas centers at x=640 on
  2560px displays; summary follows items on mobile and sits beside them at lg.
- Route and data skeletons now share the same header/row/summary structure.
  Removed delayed Framer Motion entrances and layout animations from essential
  cart content. Reduced-motion users do not get a spinning pending indicator.
- Cart estimates show each listing's actual currency, not a shifting converted
  USD total. Reviewer products total 68 NOK. Mixed currencies have separate
  subtotals; invalid/overflowing prices disable checkout. Checkout still reads
  its own server price list. Demo copy makes the zero-cost option explicit.
- `frontend/hooks/use-cart-page.ts`: locks repeated clicks per row, applies only
  the returned authoritative row, and avoids the additional GET after success.
  Failed edits cannot overwrite another row's success. A lost response triggers
  a bounded read, never an automatic repeat of a possibly committed increment.
  Rows stay present during removal/failure; refresh failure blocks edits and
  checkout until explicit recovery. Requests abort on unmount/identity changes.
- Focused units **11/11** and touched-file lint pass. First production build
  caught an optional-session type error; the corrected build and TypeScript pass.
  First browser batch **6/8**: one new test collided with Next's route announcer;
  the other exposed a genuine separate 53px auth-chrome shift. Corrected cart
  selectors/readiness yield **3/3** including setup for the eight-size scroll/
  geometry and concurrent-edit/failed-read/recovery checks. Final combined local
  batch **8/8** passes (40.2s), including real demo cart persistence/quantity/
  removal/badge and catalog Buy-now to checkout, plus Pulse/drawer regressions.
  Expanded cart/scroll units **20/20** pass.
- Additional skeleton geometry assertion passes **2/2** with setup locally:
  loaded first-row position/height stays within 2px of its placeholder. Local
  light mode was selected through Settings → Appearance, then the cart and
  footer were visually checked; actual page wheel reaches the 221px boundary.
  The drawer's quick appearance buttons are behind a hover face on touch and
  need a separate keyboard/touch audit; clicking its visible Appearance card
  correctly opens the full settings route.
- Remaining shared-shell finding: `DemoSessionNotice` inserts 53px after the
  client session resolves on hard load. Cart geometry is stable after that
  chrome resolves, but this is **not** a zero-CLS claim. A shared SSR/session
  solution needs its own auth/cache regression pass; do not hide this finding
  by merely loosening the cart assertion.
- Live cart release `176fc7a` / `dpl_5HGMUdQXeZbQEsvuFuKCBJwNKzch` is READY
  at www.veggat.com. Initial live batch **7/8**: cart cases passed, but phone
  Pulse pagination recorded a 63px scroll-offset change. Three unchanged
  repetitions then passed (**4/4** with setup). A controlled delayed-session
  browser experiment established the cause: before auth scrollTop=2000,
  clientHeight=772, scrollHeight=3245; after auth scrollTop=2063,
  clientHeight=719, scrollHeight=3308. The signed-in composer grows 63px and the
  demo notice occupies 53px. This is a genuine shared auth-layout defect, not
  a pagination failure or a claimed fix. The pagination case now explicitly
  establishes its retained demo session; shared first-paint work remains open.
- Final combined live regression **8/8** passes (46.8s) with that scope; local
  pagination recheck **3/3** passes (5.0s). Live phone and ultrawide cart visuals
  were inspected, including the actual footer scroll: 1280px canvas centered at
  x=640 on 2560px, document scrollY=0, no uncaught browser errors. The full app
  is still PARTIAL, especially the confirmed late-auth shift and owner-only
  PayPal/OAuth/Railway prerequisites. Production and local frontend health 200.
- Backend health check distinguishes contexts: anonymous `/v1/health` is 200,
  but a request carrying the frontend browser's localhost cookies returns 400
  `Invalid cookie value`. This is a separate Hapi cookie-parsing compatibility
  finding; do not relax authentication or call the service down from that one
  request. Railway deployment still needs owner authorization.
- On the unchanged live release, a settled loading-to-error experiment kept
  scrollTop=2351 and the last article's y=585.375 unchanged; only the bottom
  status/error panel size differed. Local actual cart → checkout → back → add
  the second SKU → checkout showed the updated two-line quote, not a stale
  prefetch. No checkout was submitted.
- Remaining PDP/checkout audit: pending duplicate Add/Buy lock; generic digital
  delivery copy incorrectly implies files for AI credits; forced dark PDP error
  colors; delayed below-fold sections; checkout's unqualified download-expiry
  copy and inconsistent canvas/border tokens. No owner controls, payments or
  extra AI credit grants were invoked during this cart audit.

## Shared session first-paint follow-up (local/live verified; speed work remains)

- The server now passes its verified Auth.js session into the existing provider
  tree. Demo chrome and the Pulse composer no longer depend on a client session
  GET. Page minimum height follows the actual shell space instead of post-mount
  header/banner measurements. Server API/action authorization is unchanged.
- Tradeoff: all personalized page HTML is request-rendered and private, including
  public routes (which remain accessible anonymously). Never shared-cache this
  HTML. Public asset and explicitly cached data paths remain separate.
- The new regression first failed on both widths against the old static release.
  First candidate local batch was **9/14**: geometry/cache/cart/auth checks passed,
  but all five signed-in Pulse cases exposed React hydration error 418. Readable
  development diagnostics identified `useDictation` checking browser capabilities
  in its initial state. It now uses the existing hydration-safe readiness hook;
  three new voice capability/hydration units pass without recording audio or
  contacting a provider. Combined auth/scroll/voice units **33/33**; touched lint
  passes. Corrected production build/TypeScript and local browser **20/20**
  (1.5m) pass: delayed scripts at 390/1280, private/invalid-session responses,
  eight-size cart/catalog/Pulse scrolling, auth layout, Settings, AI, Messages,
  profile and the real marketplace cart flow. Real register/verify/reset/replay/
  revocation/login/logout/2FA plus OAuth-origin checks also pass **3/3** (14s).
  Subsequent live verification is recorded below.
- Before-change warm local full-HTML round trips (three sequential samples,
  not TTFB/field CWV): guest Products 7/7/9ms, Pulse 5/6/5ms; demo Products
  10/9/9ms, Pulse 8/6/7ms, cart 6/7/6ms. These previously shared-cached bodies
  did not contain the demo notice. Session correctness has a rendering cost;
  compare it explicitly rather than claiming that every request became faster.
- After-change warm local full-HTML samples: guest Products 18/18/17ms, Pulse
  15/14/14ms; demo Products 61/60/62ms, Pulse 60/60/59ms, cart 56/56/57ms.
  All responses are private/no-store; only the authenticated response contains
  demo chrome. Home remained roughly unchanged (guest 21/19/19ms, warmed demo
  65/64ms). This is a small local sample, not a production latency/CWV claim.
- Visual check of the real 25-post mobile feed: no browser exceptions, no
  premature footer, document scrollY=0. Feed wheel reached 2000px; settled
  navigation drawer reached its 298px end while the feed stayed at 2000px.
  The first manual wheel missed because its pointer coordinates were sampled
  during the drawer entrance (x=391, outside the viewport); after transition
  completion the actual drawer x=33 was used. No application defect inferred
  from that missed input. Automated drawer tests already wait for completion.
- Fresh computer-use inventory still reports no apps/browsers. Actual owner
  Chrome/physical-phone behavior remains unverified; Playwright is not reported
  as the owner's browser.
- Initial release `4d3769b` / `dpl_6c587YbafuzPL5rL28DqidJX76Mm` is READY on
  www.veggat.com. Live first batch **19/20**: shared session/cache/Pulse cases
  passed; a Settings drawer click was accepted before its handlers were ready.
  New held-script tests fail on both old-build widths as expected. Settings
  navigation, the global menu and demo exit now share hydration-safe disabled
  states. Corrected local production build/TypeScript, touched lint, combined
  browser **22/22** and auth/scroll/voice units **33/33** pass. Live follow-up
  is recorded below.
- Live actual feed: scrolled through the filtered batches, used Check more posts,
  reached the end marker and then the footer; the footer stayed hidden while
  further batches remained. A first screenshot during scrolling did not paint
  the demo text; settled screenshot and hit-testing show its text/Exit control
  unobscured at y=72..125, with the toolbar below at y=125 and document scrollY=0.
- Speed finding remains open: first post-deploy live Pulse navigation had
  responseStart 64ms, responseEnd 5186ms, DCL 5297ms, FCP 5380ms. Warm full-HTML
  samples were Pulse 817/285/261ms and Products 476/180/141ms. These are lab
  samples, not field CWV or proof of a universal speedup. Deployment inspection
  shows runtime region **arn1** (not its iad1 build region), with 7.78MB functions;
  the primary database is London. Investigate cold execution and bundle work
  before changing regions/billing or claiming the loading-speed goal complete.
- Ultrawide Pulse content remains centered/bounded with no page overflow, but
  the shared topbar uses a wider canvas than the 1280px body. Cross-route chrome
  alignment and persistent desktop navigation remain separate unfinished work.
- Follow-up release `1c4de5c` / `dpl_98ErvyrqpWrqcPRRfjmvXTgdDzBD` is READY.
  First combined live pass **21/22**: navigation is fixed, but the auth-layout
  test's unscoped DOM locator matched two scroller copies during the streamed
  reset page. It now scopes geometry/scroll checks to the visible scroller and
  requires exactly one visible match (not `.first()` or relaxed dimensions).
  A separate warm login/register/reset DOM observation saw one visible shell
  throughout and did not reproduce the transient duplicate; no visible duplicate
  page is claimed. Final combined live rerun **24/24** passes (2.4m), including
  real recovery/2FA, private cache boundaries, both slow-script cases, eight-size
  scrolling and marketplace flow. Phone Settings drawer was visually inspected
  after its transition and Escape returns focus correctly. Local/live frontend
  health and fresh anonymous local Hapi health are 200. Whole-app completion,
  physical phone keyboard/Chrome zoom and cold-start speed are not claimed.
  Corrected auth-layout local repetitions **3/3** pass (32.4s including setup).

## Product detail / checkout follow-up

- Verified real images, primary NOK prices, credit-vs-file delivery copy,
  gallery controls, repeat purchase clicks, retry and uncertain-write UI.
  Browser fixtures intercept only fault/concurrency paths; the separate demo
  marketplace flow uses actual authenticated cart endpoints. No order or
  credit grant is required for layout testing.
- PDP/checkout canvas uses existing 1280px tokens and 16/24/32px gutters.
  Light/dark PDP checked at 360, 390, 844x390, 768, 1024, 1280x800, 1920 and
  2560. Real mouse wheels reach the product footer; drawer scrolling leaves the
  background unchanged. Footer links remain above the mobile purchase bar.
- Essential description/specification text no longer waits for scroll reveal;
  obsolete title/price typing helpers removed. Gallery image `sizes` is capped
  for ultrawide. This is a source/UX improvement, not a measured CWV speed claim.
- Landscape Report dialog was genuinely outside the viewport after its enter
  animation settled (844x390: x=198, y=-74, 448x538). Fix is scoped to ReportDialog;
  no false report submitted. Other dialogs still require the same audit.
- Initial local test 7/8, corrected footer/scroller/theme case then 11/11.
  Final candidate adds fail-closed saved-cart reads and report/share-error checks.
  Final local browser **13/13** (1.2m) and guest return-path **2/2** pass.
  Report dialog is now y=16..374 in the 390px-high viewport; selected reasons,
  text entry and cancellation pass without a report submission. Product load
  retry keeps one main document and stable gallery x/y geometry. Lint,
  webpack/TypeScript and payment units **39/39** pass.
- Release `c9ecf99` / `dpl_7iSv45jaVvxzcxEV8PWgcj6UQw52` READY at www.veggat.com;
  live browser **14/14** (1.7m) passes. Actual credit PDP and product/footer scroll
  inspected visually; 2560px checkout canvas measures x=640, width=1280.
  One long-lived headless context painted the fixed price text partly clipped
  after wheel input despite DOM x=16 and document/inner scrollLeft=0. A fresh
  live context repeating the same navigation and wheel showed the price correctly.
  Recorded as an unreproduced paint observation, not claimed a fixed device bug.
  Frontend health remains 200 locally/live. No paid order or report submitted.
- Real Chrome inventory rechecked with computer-use: apps=[], browsers=[].
  Playwright remains the active test browser. Physical phone keyboard and real
  Chrome 125% zoom have not been substituted with CSS zoom or claimed tested.

## Shared navigation / alignment follow-up

- Shared route definitions now drive both the mobile drawer and a persistent
  80px desktop rail from `lg`. The rail scrolls independently; providers and
  the main scroller stay mounted during navigation. Downloads, orders and
  profile are directly discoverable. Auth pages keep their uncluttered shell.
- Header geometry no longer morphs on scroll. Its 1280px canvas and 16/24/32px
  gutters align with the available main canvas, including the desktop rail.
  At 2560px the logo/content left edge is 712px, versus the former header's
  536px edge. Removed layout reads for an invisible hover indicator.
- Hover-only 3D settings cards replaced with explicit 44px touch/keyboard
  controls. System theme selection is retained rather than inferred from the
  resolved light/dark theme. Real links keep client navigation; privacy and
  notification editing use their dedicated settings pages. Blanket cookie,
  localStorage and sessionStorage deletion shortcuts were removed so they
  cannot erase consent, wallet or in-progress auth state unexpectedly.
- Initial local focused run **22/23** passed. The failure identified a real
  late drawer-height increase, not a scroll-test tolerance issue. Controlled
  delayed wallet JS reproduced scrollHeight **933 -> 1083px** while scrollTop
  remained 330px. A reserved wallet slot now matches the disconnected panel;
  rebuild passed webpack/TypeScript and the combined local regression **24/24**
  passes (2.2m), including the deterministic delayed-bundle case.
- Additional read-only triage captured 14 routes at 390/2560 with top/middle/
  bottom wheel scrolling (28 route/viewport checks). No browser exceptions;
  Notifications has mobile horizontal overflow and is the next scoped repair.
  This is not a claim that every button or screenshot has passed review.
- Visual inspection then caught Dashboard's old floating dock covering the new
  rail. Removed the duplicate dashboard-only shell; preserved its destinations
  in shared navigation, including role-appropriate admin links. Dashboard now
  uses the common canvas, readable light/dark tokens and accurate credit/BYOK
  copy. A new regression checks a single hit-testable rail, canvas alignment,
  footer scrolling and client-side navigation at eight sizes in both themes.
  Final webpack/TypeScript build, touched-file lint and combined local browser
  regression **25/25** pass (2.6m). Dashboard was also visually reviewed at
  390/1280 in light mode; the duplicate dock is absent and text is readable.
  Live deployment/results are recorded below when complete.
- Real Chrome inventory remains empty. Playwright is the working browser;
  physical-phone keyboard and native 125% Chrome zoom remain unverified.
- Navigation release `364d8f5` / `dpl_EBHSw9111gQQHHktYM4UnF4aXfck` is READY.
  First live focused batch **24/25** passed. The delayed-wallet fixture was
  delaying every subsequently requested script, including unrelated drawer
  infrastructure; isolating the wallet-panel bundle gives **2/2** live passes
  including setup, with unchanged height/scroll assertions.
- Separate live visual inspection caught an important existing boot flicker:
  Dashboard was visible, then replaced by the full-app skeleton. A local
  controlled delay of the Web3Providers bundle reproduced it: the original
  heading became hidden and AppBootSkeleton appeared. SSR-enabled dynamic
  imports alone did not prevent this client loading transition.
- Follow-up removes lazy boundaries around AppShell and Web3Providers; optional
  wallet panels still load on demand. This prioritizes stable readable content
  and eliminates a provider download waterfall, not the total wallet dependency
  size. Tradeoff: `/gate` no longer has a separate lightweight JS dependency
  graph, although it still does not mount the app/wallet providers. A future
  bundle reduction must isolate optional UI without making providers replace
  the page. New tests hold non-initial scripts while allowing root hydration,
  require a usable menu and retain the exact original heading DOM node.
  Final local webpack/TypeScript and touched-file lint pass; expanded browser
  regression **27/27** passes (2.3m), including both partial-loading widths.
  Follow-up `503c059` / `dpl_AHQhfw58y7yziP19fgfhhsv4LkDM` is READY at
  www.veggat.com. Expanded live regression **30/30** passes (3.3m), including
  deferred-chunk tests, ordinary product/cart navigation, both theme/viewport
  matrices, Pulse footer/pagination and drawer scroll isolation. Additional
  local auth-first-text/early-scroll/anonymous-model-selector checks **4/4** pass.
  Fresh live Dashboard startup/resize and actual mobile Pulse were reviewed
  visually: Pulse scrollTop=700, document scrollY=0, no horizontal overflow and
  footer hidden while batches remain. Local/live frontend health are 200.
  Normal initial server-route skeletons still exist; the provider-induced
  content-to-boot-skeleton transition is the scoped repair, not a CWV claim.
- Next audit findings: Notifications overflow, unnamed/dead controls, failed
  requests and wrong message destination; profile loading-shell/readiness;
  order/download layout and demo labels. The demo order list shows a nominal
  68 NOK total as completed/paid while the demo notice says no payment; confirm
  charged-vs-list-price presentation against the verified receipt before changing
  monetary storage. No payment/grant was made by this navigation audit.

## Research references

- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)
- [W3C evaluation methodology: scope, states and complete processes](https://www.w3.org/TR/WCAG-EM/)
- [W3C preliminary checks and their limits](https://www.w3.org/WAI/test-evaluate/preliminary/)
- [Playwright user-visible testing and isolation](https://playwright.dev/docs/best-practices)
- [WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [Layout shift diagnosis](https://web.dev/articles/optimize-cls)
- [Playwright emulation and its limits](https://playwright.dev/docs/emulation)
- [Next.js lazy loading / prerendering](https://nextjs.org/docs/app/guides/lazy-loading)
- [Wagmi v2 SSR](https://2.x.wagmi.sh/react/guides/ssr)
- [React hydration consistency](https://react.dev/reference/react-dom/client/hydrateRoot)
- [React external-store server snapshots](https://react.dev/reference/react/useSyncExternalStore)
- [CSS relational selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:has)
- [CoinGecko historical market-chart intervals](https://docs.coingecko.com/demo/reference/coins-id-market-chart)
- [CoinGecko Demo header authentication](https://docs.coingecko.com/demo/reference/authentication)
- [Next.js persistent function caching](https://nextjs.org/docs/app/api-reference/functions/unstable_cache)
- [CSS overflow and programmatic scrolling](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow)
- [Next.js request-time rendering](https://nextjs.org/docs/app/api-reference/functions/connection)
- [Auth.js server/client session initialization](https://authjs.dev/getting-started/session-management/get-session)
- [CSS subgrid](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Subgrid)
