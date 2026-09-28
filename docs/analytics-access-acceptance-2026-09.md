# Analytics access and recovery — September 2026

Application source: `9c437cd` on `release/showcase-september`. Main unchanged.
No database migration, credentials, permissions, payment or credit changes.
Rollback: `72e528e` / `dpl_G8smj6frN5e8EVfje5tRrar43owu`
(`dev-veggastare-6vmubvylb-v3ggas-projects.vercel.app`).

## Correction and evidence

- Baseline `hooks/useFetchAnalytics.ts:20` and
  `hooks/useFetchUserProductCreationAnalytics.ts:19` retained old report content
  after a 401/403 refresh. Both browser regressions reproduced against the
  preceding production-mode local build. Initial attempts exposed test session
  setup timing instead; only the corrected fixture run is regression evidence.
- The shared private reader now resolves denied access as a data-free cache
  entry. Charts/counts disappear and do not return after a later 503. Successful
  authorization/read restores the report. Other temporary failures still retain
  previously authorized data with the existing explicit stale-data notice.
- Cache keys remain user/endpoint scoped and have a new shape version. A
  15-second abort bounds fetch/body waits; unreadable data and network failures
  produce human-readable retry errors. No automatic retry loop was introduced.
- This removes cached display data after a denial response. It does not promise
  to recall data previously downloaded/saved, or detect role changes before a
  server response. Existing server ADMIN checks remain the authority.

## Local verification

- Strict production build/TypeScript, touched ESLint and diff checks pass.
- **28/28 units**, four files: denial response handling, no-store requests,
  validation, actual timer-triggered abort, UTC growth parsing and API guards.
- **6/6 browser checks pass, 23.5 seconds**, retries disabled. Two new cases
  cover growth/publishing 200 → 403/401 → 503 → 200 transitions. The existing
  preview/control and administrator-error suites run at 390 and 1280, then
  resize all three growth reports across 360, 390, landscape 844, 768, 1024,
  1280, 1920 and 2560. They exercise dates, invalid/empty ranges, tables, actual
  wheel scrolling, sidebar containment, footer reachability and overflow.
- Four older checks initially failed because they skipped a not-yet-mounted
  consent panel or dispatched a session event before its listener existed.
  Tests now wait for consent/session setup; no scrolling/error assertion was
  weakened. Screenshots confirmed the consent panel covered the wheel target.
- Role/data fixtures are browser-only. The retained account is still USER,
  and actual private endpoints return 403. No real admin session was granted,
  no private platform data was used as a fixture, and no database writes ran.
- Real Chrome exercises the actual sample range/table and keyboard scrolling
  at its measured 2498px desktop viewport. The final row and footer are visible.
  Do not count this as physical-phone or native 125% zoom acceptance.

## Deployment verification

- Preview `dpl_GrtrTRfCoiDacQUvB5akHePUHLpr` (`gfps9mb5h`) passed the same
  six checks in 47.8 seconds, with retries disabled.
- Production `dpl_ASxDaUbduMNpF9P2YLTdXwLpPxcg` (`k8hey0bvt`) passed the
  strict Vercel build and TypeScript. Health and environment-locked Live checkout
  readiness passed before promotion. www.veggat.com was inspected against the
  exact deployment after promotion; six live browser checks pass in 51.2 seconds.
- The Live PayPal app was read in real Chrome: its existing webhook still targets
  `https://www.veggat.com/api/webhooks/paypal` and tracks completed/refunded/reversed
  captures. This is configuration evidence only: the owner clarified no Live
  payment has been completed. Do not mark Live capture acceptance as done.
- Speed Insights Production desktop (last seven days, 119 events) currently
  reports RES 75, FCP 3.43s, LCP 3.75s, INP 248ms and CLS 0.01. Products scores
  64 versus home 96. The small, mixed-release sample may include QA traffic;
  it is not proof of this release's improvement or representative mobile data.
- Vercel displays a failed-payment/invoice warning. No billing setting or charge
  was changed. Deployment succeeded, but the owner must resolve account billing.

## Scope limits

This is a cache/error-recovery correction, not a new analytics or workspace
product. It does not certify all analytics endpoints or the full app. Owner
Live purchases/refunds, human email/legal review, remaining OAuth/wallet/backend
checks, general-listing/verified Web3 checkout and exhaustive route interactions
remain separate acceptance work. Hosted CI still requires the owner's billing
resolution.

UI-review, webapp-testing and computer-use informed explicit failure states and
observable controls/scroll checks. The review used the current
[Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
Ignored artifacts: `frontend/test-results-release-analytics-access-*`; retained
browser auth state remains in the excluded `.private-showcase` directories.
