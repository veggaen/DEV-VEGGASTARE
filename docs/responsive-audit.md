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

## Research references

- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)
- [WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [Layout shift diagnosis](https://web.dev/articles/optimize-cls)
- [Playwright emulation and its limits](https://playwright.dev/docs/emulation)
- [Next.js lazy loading / prerendering](https://nextjs.org/docs/app/guides/lazy-loading)
- [Wagmi v2 SSR](https://2.x.wagmi.sh/react/guides/ssr)
- [React hydration consistency](https://react.dev/reference/react-dom/client/hydrateRoot)
