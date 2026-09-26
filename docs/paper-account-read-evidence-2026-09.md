# Paper-account persistence/read acceptance — 26 September 2026

## Findings and scope

Portfolios, positions and core paper trades were already saved in PostgreSQL,
under a unique user-owned portfolio. The focused application/cron/script scan
found no expiry routine for paper accounts. This does not prove that the owner's
past disappearance was deletion, nor simulate months of actual uptime.

Three reproducible presentation/read defects were corrected:

- Any failed portfolio read was treated as a missing account, offering creation
  instead of recovery. Failures now preserve the last loaded account and offer
  retry; only an explicit missing record offers creation. Expired sessions clear
  protected data. Requests are sequence-guarded and state is keyed by identity.
- History exposed only the newest 50 records. Owned keyset pagination now loads
  older rows, with a deterministic timestamp/ID tie-breaker and bounded page size.
  Failed pagination/refresh retains loaded rows and retries the correct request.
- Missing prices were valued at zero, creating false losses. Missing, invalid or
  over-60-second stale quotes now produce unavailable valuations, not zero holdings.
  Quote-provider failure does not prevent reading the stored portfolio.

The reset warning now matches the existing behavior: positions are cleared but
trade history remains. No reset implementation, balances, executions, prices,
schema, PayPal or credit-ledger writes were changed by this slice.

## Verification

- 16 focused read/authorization/pagination/quote tests pass.
- Touched-file lint and strict production build/TypeScript pass.
- Real Chrome confirms the local account's explicit new-portfolio state. No
  portfolio was created for the owner.
- The real-server isolated browser test seeds 61 dated history records (some with
  identical timestamps), holdings and cash. It uses two disposable password
  accounts plus an independent fresh sign-in. It verifies committed values,
  older-page access, other-account cursor denial, failure recovery and unavailable
  quotes. Network failures are injected; successful reads use the real server
  and database. Backdating fixtures is not proof of real elapsed-time retention.
- Eight actual-server cases pass locally (54.7 seconds) and on isolated hosted
  Preview (1.7 minutes): 360×800, 390×844, 844×390, 768×1024, 1024×1600,
  1280×800, 1920×1080 and 2560×1080, alternating light/dark themes. All check
  history pagination, interrupted reads, price unavailability and document width;
  360/1280 additionally test independent login and a second user's cursor denial.
  Phone, landscape and ultrawide screenshots were inspected. 125% browser zoom
  and full trade-panel visual acceptance remain open.
- Early test runs exposed a consent overlay and excessive repeated sign-ins.
  Tests now choose Essential Only, retain auth throttles and use fewer redundant
  logins. One timed-out test left two disposable users; exact-ID cleanup removed
  them, and cleanup now tolerates already-closed browser contexts.
- Preview `dpl_4fsDqLSYqiEgvFhy6wbqJZ9R8LpP` is Ready on the stable Sandbox
  alias. Runtime `e9b692e` is integrated as `cd803cf`. An earlier Preview attempt
  was correctly rejected before migrations due to callback-origin configuration;
  the established isolated deployment helper supplied the correct configuration.
  No new credentials or migrations. Release secret scan passes.
- Production `dpl_CTiT6r6PbEsYgWQ11nrqrJKdJLgK` is Ready on `www.veggat.com`,
  built from the isolated UI release tree with 56 migrations and none pending.
  No integrated Preview payment/schema changes were promoted. The combined
  paper/product unit regression batch passes 124 tests across ten files; both
  read-only public product browser checks pass on this Live release (390/2560).
- Real Chrome verifies the updated Live paper history at 390×844 and 1280×800,
  including refresh, no horizontal overflow and no new console errors. The
  owner's existing $100,000 virtual cash/total, empty positions and empty history
  remain unchanged. No Live portfolio mutation was made; temporary browser
  viewport overrides were reset. The eight mutating fixture workflows above
  ran only against the isolated test database, not Live.
- The trading page's inline paper panel is only a link to this dashboard; its old
  context is a compatibility shim, not separate persisted balances.

## Still open

This is not full paper-trading acceptance. Buy/sell/swap balance checks before
transactions, fire-and-forget unified TradeRecord writes, reset throttling,
token/decimal authority, quote freshness during execution and concurrent orders
need their own fixes/tests. Trading layout/controls, actual two-party P2P and
local-chain settlement remain unverified. The module stays experimental.

## Reproduce

```text
npx vitest run lib/paper/read.test.ts --exclude '**/e2e/**'
E2E_BUSINESS_DB=isolated-preview [isolated Preview launcher] playwright test --config playwright.route-audit.config.ts --grep 'isolated paper history' --max-failures=1
```

The browser test rejects Live origins/databases, creates exact disposable users,
and removes only those users (cascading their paper fixtures) in cleanup.
