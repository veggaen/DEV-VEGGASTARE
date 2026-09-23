# Interview-path CI

This focused workflow is separate from the broad legacy E2E suite and ordinary
lint/build jobs. A passing focused journey is not a claim that all features or
all repository checks are green.

## Scope

- PostgreSQL 16 service, empty `veggat_ci` database, synthetic seller/catalog.
- Node 22; Prisma generate; strict webpack/TypeScript production build.
- Real Auth.js demo session, public product with a loaded image, 122-credit cart,
  390/1280 layouts, simulated first checkout failure, same-key retry and an
  actual **unpaid** demo receipt. Replaying completion returns the same order.
- PayPal server transport and capture/refund policy use unit mocks. No payment
  or AI provider credentials are injected. No real payment or paid grant occurs.
- Reports/screenshots retained for seven days; only synthetic session data is
  captured. The workflow has read-only repository permission.

## Safety and limitations

`setup-ci-showcase.mjs` refuses remote endpoints, non-CI execution, a live URL,
provider keys and nonempty databases. Only the explicitly named loopback CI
service can use plaintext PostgreSQL; remote deployment TLS behavior is unchanged.
The [service-container configuration](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers)
uses a runner-local mapped port, not a hosted application database.

Historical migrations begin with alterations, without an initial baseline.
Therefore the browser fixture bootstraps the current Prisma schema using
`db push`, without `--force-reset` or `--accept-data-loss`. This does not exercise
historical SQL check constraints or prove a new deployment can replay migrations
from empty. The opt-in `showcase-postgres.test.ts` covers the actual upgraded
Preview constraints and rolls back its synthetic orders. Migration baselining
needs a separate reviewed release; never run `db push` on production.

## Running

GitHub Actions: run **E2E Tests (Playwright)** on the desired branch, with no
external URL or secret inputs. Pull requests to `dev`/`main` also trigger it.

Against an already-running isolated local app:

```powershell
cd frontend
$env:E2E_BASE_URL='http://localhost:3000'
$env:E2E_CI_SHOWCASE='1'
npx playwright test e2e/suite.spec.ts --project=no-auth --grep 'CI showcase happy path' --retries=0
```

This creates one normal disposable demo identity/order and respects all signup
and checkout caps; do not repeatedly reset or bypass them. Do not point this
command at an owner's signed-in storage state.

## Evidence

Local production-style app: focused journey **2/2** including setup passes on
23 September 2026. CI database guard tests **12/12** and touched lint pass.
Strict local type-check also passes. Hosted run
[35925329121](https://github.com/veggaen/DEV-VEGGASTARE/actions/runs/35925329121)
on `883ab64` was rejected before any step started: GitHub reports the account is
locked by a billing issue. **Hosted CI is BLOCKED on owner billing resolution**,
not a green run or evidence that the new PostgreSQL job executed. No billing or
spending setting was changed. Re-run only after the owner resolves the lock.
