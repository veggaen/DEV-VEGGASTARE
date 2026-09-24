# Integrated release candidate — 24 September 2026

## Scope

`release/showcase-september` merges Showcase `8a5bb26` with production currency
branch `903db05` (live app source `bfe4fd3`). It was created in a separate clean
worktree; existing owner, Showcase, security and currency worktrees were preserved.
No direct push to `main` is used.

The merge retains the live currency selector, currency-aware catalog filters,
delayed-hydration basket guard, failed-read retry and row-isolated uncertain-write
reconciliation. It also retains Showcase's custom credit pricing, verified refund
and reversal handling, private downloads, explicit delivery requests, immutable
original confirmations, ledger controls and responsive product gallery.

The shared cart hook distinguishes ordinary quantities from credit amounts.
Credit amounts wait for a validated, server-priced response; ordinary quantities
retain optimistic row updates. The mini-basket uses the custom-credit editor and
its shared checkout lock instead of presenting credit packs as ordinary quantities.
No client display conversion becomes a payment amount.

## Database boundary

Four migrations beyond production are included: credit refund adjustment,
payment reconciliation metadata/states, nullable bounded cart credit amount, and
the bounded custom-credit order ceiling. They add seven fields in total and
replace relevant CHECK constraints; they do not delete tables, rewrite captured
orders or manufacture purchases. Existing order totals fit the expanded ceiling.
Preview has already applied them. Production application is still pending.

## Local verification

- Strict webpack build and TypeScript pass using Next 16.3.6.
- Touched-file ESLint passes.
- 235 focused payment/catalog/currency/cart units pass; the opt-in PostgreSQL
  checkout case was run separately and passed all six rolled-back scenarios.
- 30 ledger/configuration tests pass, including 21 real PostgreSQL cases in an
  isolated temporary schema. No public balance, payment or production data changed.
- Custom-credit product → basket → cart → checkout → free receipt passes locally.
  It covers exact 122/555 amounts, invalid values, saved prices, cross-surface
  draft locks and rejection of a stale checkout quote.
- An initial run lacked the new worktree's browser gate fixture; the setup project
  created it from the public homepage without a password or gate change.
- The next ten-test batch passed nine journeys, with a transient credit-product
  load failure. Its isolated rerun passed and real Chrome's Retry recovered. A
  repeat batch captures product API statuses rather than assuming a cause.
- The repeat passed the other nine journeys, including the credit-product check.
  Fresh demo sign-in instead hit the existing per-visitor daily cap: a read-only
  isolated-database count confirmed 5 accounts against the cap of 5. No accounts
  were deleted, counters reset or rate limits weakened. Reuse retained demo
  sessions for remaining acceptance. Across runs all 11 distinct selected local
  journeys passed; neither ten-test bulk run was entirely green. The initial
  product-load failure's status was not captured, so its cause remains unproven.
- Real Chrome retained its demo session after the integrated server replaced the
  previous build. The 555-credit preview showed 206.51 NOK and 9.94 NOK savings;
  the gallery, access text and specifications updated together. Desktop 1280
  geometry was visually checked. No PayPal transaction was submitted.

Local runs use the isolated Neon Preview database and credentials authenticated
against PayPal Sandbox only. The private launcher forwards an allowlisted set of
local app values in memory; no Live PayPal keys or production database URL are
copied into this worktree.

## Release boundary

Candidate only until deployed verification is recorded here. Current production
rollback target is `dpl_DVNrF5kqvrnRPbRtjmzr5yd9jJbc` (`bfe4fd3`). Current Preview
rollback target is `dpl_FSe3qUPRo4eBrCqXqHjtm8jG2NrM` (`4eb2e76`). After additive
database migrations, rollback code only; do not drop fields or financial records.

Live micro-purchase acceptance, email/full-agreement delivery, electronic
withdrawal flow, legal review and the wider S1–S9 scoreboard remain unfinished.
This merge is not evidence that every route, provider consent or payment path works.
