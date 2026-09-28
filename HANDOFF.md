# Veggat development handoff — 27 September 2026

## Release-check update — 28 September 2026

The unsuffixed folder is now on `feat/chrome-kernel`, committed HEAD `420369e`
(also `origin/dev`), plus uncommitted release/auth fixes. The branch/folder table
below records the earlier handoff, not the current primary branch. PR #86 is
`dev` → `main`; no merge, push or Production deployment was performed during
this release-check pass.

- GitHub's automated jobs fail **before starting** with an account billing-lock
  annotation, including a retry. The repository is public. The owner's billing
  overview shows GitHub Free, 0/2,000 minutes, $0.42 gross usage fully discounted,
  and no next payment due. This is not evidence that pushing code requires a paid
  plan or that an Actions allowance was exhausted. No billing settings changed.
- Corrected branch-scoped Vercel Preview `AUTH_URL` and `PAYPAL_WEBHOOK_ID` for
  `dev` and `feat/chrome-kernel` using the existing isolated Preview callback and
  matching Sandbox webhook. Verified Production environment entries unchanged.
  A fresh hosted Preview build has not yet been verified.
- Local production build, TypeScript, full quiet lint, 2,507 Vitest tests and five
  Node deployment-preflight tests pass. 278 optional tests were skipped; this is
  not equivalent to database, payment or full business-workflow acceptance.
  Twenty baseline browser/API checks pass. Public/demo entry and product gallery
  layout at eight viewport sizes pass. After updating obsolete gallery/credit
  preview selectors, the demo cart journey also passes: both product lines,
  reload persistence, quantity changes, removal and demo upload denial.
- OAuth account linking now rejects stale/revoked/demo/impersonated sessions,
  checks the database token version, and does not mark an unrelated primary email
  verified. Confirmation notices target the existing account email. Unit coverage
  was added. No automatic cross-email merge was enabled.
- Release review found a concurrency risk in `actions/paper-orders.ts`: settlement
  executes a paper trade before changing the order from OPEN. Concurrent polling
  or cancellation can race. This remains unfixed and must be addressed before
  calling the new paper-order feature production-ready. The earlier paper
  execution and Live merchant currency-preference checks also remain open.

Keep new release fixes separate from user-authored design instructions and ignored
local credentials. Do not merge to main solely because a local build is green.

## Start here

Use the **unsuffixed `DEV-VEGGASTARE` folder** for new development. It is now on
`chore/ai-handoff-2026-09-27`, based on integrated commit `1ed89da`, rather than
the old local `main` (`9b1c015`). This is the latest development state, **not a
claim that every feature is production-ready**.

Read [the feature scoreboard](docs/production-scoreboard.md) and
[the expanded business-workflow checklist](docs/business-workflow-acceptance-2026-09.md)
before continuing. Route rendering alone is not feature acceptance.

## Why the other folders exist

These are Git worktrees: separate checkouts sharing the same Git history, with
their own branch, files and local environment. They are not six independent apps.

| Folder | Purpose / branch |
| --- | --- |
| `DEV-VEGGASTARE` | Primary development and this handoff; `chore/ai-handoff-2026-09-27` |
| `DEV-VEGGASTARE-release` | Integrated development/Preview candidate; `release/showcase-september` |
| `DEV-VEGGASTARE-ui-release` | Verified Live UI/security fixes, excluding pending settlement changes; `release/ui-september` |
| `DEV-VEGGASTARE-showcase` | Earlier showcase work and local isolated-QA configuration; `showcase/ai-revival` |
| `DEV-VEGGASTARE-currency` | Earlier production currency-display fix; `fix/production-currency-display` |
| `DEV-VEGGASTARE-security` | Earlier production dependency/security fix; `fix/production-security-september` |

No worktree was deleted. Some older trees contain uncommitted notes/test artifacts
and ignored local credentials. The UI tree also shares a dependency junction with
the release tree. **Do not delete these folders in Explorer.** Inspect `git
worktree list` and each tree's status before any later retirement.

## Production and Preview must stay separate

- Verified Live code: `release/ui-september`, `d1968b7`; latest recorded deployment
  `dpl_Dvh5WgvxFyYVLGqmdpb8K28MdkKa` (same source, Discord environment refresh),
  `https://www.veggat.com`, **56 migrations**.
- This development branch includes native-currency/exact-spend checkout work and
  **57 migrations**. Those additional payment/schema changes are not yet Live.
- Last verified isolated Preview: `dpl_4fsDqLSYqiEgvFhy6wbqJZ9R8LpP` at
  `https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app`.
- Exact settlement has real Sandbox purchase/refund/replay evidence, but Live
  merchant currency preferences and controlled production migration/promotion
  remain open. See [settlement evidence](docs/exact-currency-settlement-2026-09.md).
- Uploading this branch is a source handoff, **not authorization to deploy its
  pending migration to production**. Keep GitHub `main` behind a reviewed release.
  No force-push, bulk branch merge, production migration or database push.

## Latest verified changes

- Company/product lifecycle permissions use fresh authorization and locked
  writes; edit/hide/archive permissions are independent. Removed employees lose
  access. Archives retain paid download eligibility. Public product data excludes
  private configuration. Company form hydration is fixed.
- Paper accounts distinguish missing data from failed reads, preserve loaded
  balances on failures, paginate beyond 50 history rows and avoid false zero-value
  losses when quotes are missing/stale. These read fixes are Live.
- Previous scoped conversation privacy, AI chat, commerce, consent and loading
  work is retained. Each evidence document states what actually passed.

Do not sum mocked, real-database, browser and Live tests into a claim that every
business workflow works. The latest paper/product regression batch passed 124
unit tests; paper reads passed eight viewport scenarios locally and on Preview.

## Continue in this order

1. Paper execution: lock balances/positions inside transactions, prevent concurrent
   overspend/oversell, make unified trade history durable, enforce fresh session
   and authoritative token/decimal/quote checks; fix reset throttling. Do not
   alter real-asset flows while testing virtual funds.
2. Full physical/digital publication through the actual upload wizard, company
   and employee UI, independent permissions, removal/revocation and fulfillment.
3. Jobs: two-user post/apply/accept/cancel/complete lifecycle and permission denials.
4. Two-party P2P and isolated local-chain settlement, including rejection, replay,
   wrong-chain and reconnect cases. No real assets.
5. Remaining route controls and responsive visual QA; retain concise copy and
   existing design tokens. Test actual scrolling, dialogs and keyboard access.

Use disposable accounts in the isolated database. Verify saved state through a
fresh login and a second account. Phone, landscape, portrait, desktop, ultrawide
and 125% zoom are acceptance targets; not all are fully certified yet.

## Local setup and safety

### Local login repair — 2026-09-27

The styling branch's local setup had selected an older database. The known test
account existed there without a password or linked providers; its Google/GitHub
links were still present in the previously verified isolated QA database. Core
authentication code had not changed. Restoring the ignored local configuration
fixed Google and GitHub browser round trips without manually linking accounts or
weakening PKCE, cookies, CSRF, or email-linking protections.

`frontend/.env.local` now selects that isolated QA database through
`DATABASE_URL_MAINDEV`, explicitly uses `http://localhost:3000` for both auth URL
variables, and has development OAuth and Sandbox-only PayPal credentials. Never
publish this file. A local-only backup is retained under the ignored
`frontend/scripts/_probe/` directory. No migrations, production changes or Live
purchases were performed. Purchase-confirmation email sending remains off locally
to prevent accidental mail to real recipients.

The login page and signed-out header menu discover configured providers from `/api/auth/providers`, disable
buttons until discovery finishes, omit unavailable providers, and offer retry
after a discovery failure. Keep the new styling branch; do not restore old auth
files over it. Git branches do not carry ignored environment settings.

On 2026-09-27 the owner requested Discord repair for development and production.
The Discord portal already registers
`http://localhost:3000/api/auth/callback/discord` and
`https://www.veggat.com/api/auth/callback/discord`; Public Client remains off.
The prior local/Vercel secret returned HTTP 401 `invalid_client`. The owner reset
it in Discord; the replacement was saved in the existing Vercel variable
(including Production; environment scope unchanged) and ignored local
`frontend/.env.local`, without printing its value or touching payment/DB keys.
Local Discord now completes a real Chrome sign-in to the Discord identity's
account. That identity uses a different email from the Google/GitHub test user;
do not merge the accounts automatically. The existing Live deployment alone was
redeployed as `dpl_Dvh5WgvxFyYVLGqmdpb8K28MdkKa` to load the new secret. It is
READY and the `www.veggat.com` alias points to it; health returns 200. The build
reported 56 migrations and none pending. Production Discord initiation reaches
the correct HTTPS callback/S256 login flow, but Discord requests fresh sign-in.
The retained browser tab is awaiting the owner; positive Live callback acceptance
is not yet recorded. Never enable dangerous automatic account linking to bypass
`OAuthAccountNotLinked`. Older worktree environment files retain the invalid
secret; do not copy it back over the repaired environment.
Anthropic and AI Gateway keys were not present in the prior local QA
configuration and remain unconfigured.

Auth repair verification: Google/GitHub and demo login passed in real Chrome;
existing QA password login and logout passed through the Auth.js CSRF flow.
130 focused auth tests across 10 files, TypeScript, and lint on changed
auth/header files pass. Provider buttons now hide unconfigured methods instead of advertising a
broken route. This is not a claim that all application features are verified.

Local `.env*` files were preserved, not copied to GitHub. Do not assume the older
main-folder environment is correct for current code. Check variable names and
target hosts without printing secret values. Use `http://localhost:3000` for
OAuth; never substitute 3100. Use an isolated development/Preview database and
PayPal Sandbox. Never copy Live PayPal keys or the Live database into local tests.

Lockfiles are authoritative. Install root/frontend/backend dependencies before
starting; Prisma generation is safe only after inspecting the selected target,
and is not permission to run migrations. Do not run `prisma db push` against a
shared or production database. Existing ignored QA helpers in the worktrees may
use absolute paths; inspect them before reuse rather than publishing them.

No new payment, user balance change, database migration, or production deployment
is part of this folder/GitHub handoff.

## Handoff verification and GitHub status

- Root, frontend and backend dependencies were installed from their lockfiles.
  The existing EdgeStore patch was applied. Both Prisma clients were generated
  using a dummy loopback URL; no database connection/migration was required.
- Old main-folder Next.js generated types were incompatible with the current
  dependency version. The old `.next` directory was moved to the local temporary
  folder `veggat-handoff-cache-20260927/old-next` for recovery, and `next typegen`
  regenerated current route types. Frontend `tsc --noEmit --incremental false`
  then passed without changing application source.
- 129 focused frontend tests pass across 11 files (product lifecycle/catalogue,
  account recovery and paper reads). Backend build and all five integration
  boundary/security tests pass. This handoff did not rerun the full app audit.
- The outgoing integrated and Live branch histories were scanned for secrets.
  The exact historical mocked-token false positive is documented in
  `.gitleaksignore`; private local recovery refs were not pushed.
- Uploaded branches: `chore/ai-handoff-2026-09-27`,
  `release/showcase-september`, and `release/ui-september`.
  [Draft PR #85](https://github.com/veggaen/DEV-VEGGASTARE/pull/85) targets `dev`.
  GitHub `main` and `dev` were not changed or merged.
- GitHub CI, E2E and CodeQL jobs did **not start**: GitHub reports the account is
  locked due to a billing issue. This is not passing CI. No billing settings were
  changed. The older default branch also retains dependency alerts; do not treat
  an upload as resolution of those alerts.
- The automatic handoff Preview `dpl_EsiSutL3DXrryYPYP2Uirv8p8uL5` failed safely
  before migrations because its inherited `AUTH_URL` is not a Preview HTTPS
  origin. Do not weaken that guard. Configure a branch-appropriate callback and
  isolated Preview environment before trying that deployment again. The previously
  verified stable Preview and Live deployments were not replaced by this failure.

## Preserved older local work — LOCAL ONLY

Before updating the primary folder, its 30 changed/untracked frontend files were
preserved exactly in a Git stash, also anchored by the stable local ref:

`refs/local-backups/main-before-handoff-2026-09-27`

The ref is `20fe8f27fa8e11720e21f93c02653911fac1ab27`, based on old `9b1c015`.
It includes earlier poll experiments and private development helpers. It is
**not part of the uploaded branch**. Keep it local; never push all refs, stash
refs, checkpoints or a repository mirror. Some helpers contain hard-coded old
database credentials; the owner should rotate any that remain active.

Do not apply this old stash over current authentication/schema code wholesale.
Many features already exist in newer form. Review individual differences in a
disposable recovery checkout and port only genuinely missing behavior after
removing credentials. The stash's third parent preserves its untracked files.

The accidental `%SystemDrive%` cache and ignored environments, databases, reports
and private QA artifacts remain local. Nothing material was deleted.
