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
- Ignored evidence directory: `frontend/.private-showcase/responsive-audit/`
  (`core-local`, `all-local`). Never commit storageState, private URLs or tokens.
- Lab timings are diagnostic only, not field Speed Insights or a claimed Core
  Web Vitals pass. Test/automation traffic is not genuine visitor telemetry.

## References

- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)
- [WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [Layout shift diagnosis](https://web.dev/articles/optimize-cls)
- [Playwright emulation and its limits](https://playwright.dev/docs/emulation)
