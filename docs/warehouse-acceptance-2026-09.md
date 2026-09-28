# Warehouse reliability and responsive QA — September 2026

## Scope

Application source: `72e528e` on `release/showcase-september`. This slice fixes
the experimental warehouse list/detail and stock-adjustment boundary. It does
not enable shipping, change payments/credits, or grant new warehouse roles.
Main is unchanged; there is no database migration.

## Reproduced failures and corrections

- A stock decrement at zero returned success and attempted negative stock.
  A supplied warehouse ID could also differ from the inventory row's warehouse.
  Both regressions failed against the preceding source. Runtime input validation,
  location binding and a nonnegative PostgreSQL-integer range now precede writes.
- ADMIN-only authorization is retained. Updates bind both location and the read
  version; concurrency conflicts require a refresh, not an automatic retry.
  Notification failure after a committed update does not falsely report a failed
  write. Sensitive inventory details were removed from console logging.
- A failed warehouse read previously also said “No warehouses available.”
  A long, unbroken address overflowed a 360px canvas. Both browser regressions
  reproduced before correction. Errors, empty results and loading are distinct;
  addresses wrap without horizontal scrolling.
- List and detail now share a bounded responsive workspace, 44px actions,
  card-shaped skeletons, permission explanations and explicit experimental status.
  The hourly read refresh remains, without the old per-second countdown renders.
- Reads validate the existing DTO, time out after 12 seconds and abort on
  navigation. Saved data is scoped to the user/role and endpoint. Temporary
  failures retain valid rows; 401/403/404 discard them. Failed/uncertain stock
  actions cannot be retried until a successful stock refresh.
- Real Chrome found a further empty-state flicker during refresh. The empty
  card now stays mounted; its announcement is screen-reader-only so neither
  empty nor populated results shift. Held-response regressions assert geometry.

## Local acceptance

- Strict production build and TypeScript pass; 188 routes generated. Touched
  ESLint and `git diff --check` pass.
- **26/26 unit tests**, five files, cover stock guards, optimistic conflict
  handling, read errors/validation, permission DTOs and notification behavior.
  Stock mutation tests mock the database: no real stock was adjusted.
- **6/6 scoped browser tests pass in 21.2 seconds**, retries disabled. Warehouse
  responses are controlled fixtures; the real demo session is retained. They
  cover refresh continuity, error recovery, access revocation, long addresses,
  detail navigation and footer scrolling at 360, 390, 844 landscape, 768, 1024,
  1280, 1920 and 2560 widths. The existing Pulse filter, sidebar-scroll and
  delayed-pagination/error-retry regressions also pass.
- **1/1 real isolated-database read test passes in 2.8 seconds**. A private runner
  verifies the exact isolated Preview database host, creates one uniquely named
  disposable warehouse plus one inventory row, and tests actual list/detail
  navigation/refresh at 390 and 1280. Anonymous detail access is 401; the demo
  USER sees basic location data and no inventory/products or stock controls.
  Both exact synthetic rows are removed in `finally`. Existing product stock
  and other data remain unchanged. This runner refuses a production target.
- Real Chrome verifies the 390px empty card stays visible during refresh,
  scrolls the page to its actual footer and the mobile navigation to its lower
  controls. Closing the drawer preserves the page's bottom scroll position.
  The controlled tab is measured at 390×844. The browser-wide viewport control
  follows Chrome's selected tab (which can differ from the controlled tab), so
  the temporary test tab is closed after acceptance rather than leaving
  a hidden override behind.
- A separate 22-check, 390/1280 route triage found no uncaught exceptions,
  failed requests or overflow on Pulse, warehouses, Nexus, community guidelines,
  accessibility, trading/paper-trading, analytics and three legacy aliases.
  This is navigation triage, not acceptance of every control on those routes.

## Deployment acceptance

- Preview: **`dpl_EmBFVUHqVmDvpro2zUaZif7HUre2`** /
  `dev-veggastare-rm674tubu-v3ggas-projects.vercel.app`. The stable Preview alias
  was inspected against this exact READY deployment. Strict build/TypeScript
  pass; 48 migrations, none pending, against the isolated database.
- **6/6 Preview browser checks pass in 32.7 seconds**, with retries disabled.
  **1/1 actual isolated-database read/access check passes in 10.0 seconds**,
  including the exact two-row cleanup. Real Chrome also confirms the actual
  390px Preview empty state remains during refresh without page overflow.
- Production: **`dpl_G8smj6frN5e8EVfje5tRrar43owu`** /
  `dev-veggastare-6vmubvylb-v3ggas-projects.vercel.app`. Strict build/TypeScript
  pass; 48 migrations, none pending. Before promotion the candidate health was
  healthy, payment capabilities remained reviewer-only Live PayPal, and the
  public domain still resolved to the preceding release. After promotion,
  www.veggat.com was inspected against the exact new READY deployment ID.
- The first live run was **5 passed / 1 test-selector failure**: an unscoped
  level-two heading also matched the cookie panel. Scoping to `main` corrects
  the test without changing or weakening its overflow assertion. The revised
  check was rerun locally and on Preview, and **6/6 live checks pass in 27.8
  seconds**, retries disabled. Production application source is unchanged by
  this test-only correction.
- Real Chrome additionally verifies actual live warehouse rows, inventory
  expansion, detail navigation, refresh continuity and scrolling to the footer
  at 390×844. Existing incomplete addresses are explicitly labeled. Captured
  error logs are empty; no stock controls were submitted. The temporary QA tab
  is closed, and the PayPal/payment/email-provider handoffs are preserved.

Previous production/rollback: `bbadc04`,
`dpl_Gh1cjhYcXTydb3T3qnsxoZ3TureT`
(`dev-veggastare-e19uognhv-v3ggas-projects.vercel.app`).

## Boundaries

No live stock adjustment, order, payment, refund, credit grant or wallet action
occurred. Administrator stock controls and concurrent real-database writes still
need dedicated non-production admin acceptance; unit mocks are not that evidence.
Realtime invalidation permissions retain their existing scoped tests, not a new
multi-client browser certification.

Owner Live purchase/refund, legal review, human-inbox delivery, remaining OAuth,
wallet and backend acceptance, general-listing/verified Web3 checkout, exhaustive
route interactions, native 125% zoom and physical-phone keyboard checks remain
separate gaps. No whole-app security, accessibility or field-speed certification
is claimed. Webapp-testing, Web Interface Guidelines and computer-use informed
deterministic regressions, responsive targets and actual scrolling checks.

Local browser artifacts remain excluded from deployment under
`frontend/test-results-release-warehouse-*`; private runner and auth state stay
under the excluded `.private-showcase` directories.
