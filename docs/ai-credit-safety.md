# AI credit safety

Status: **foundation tested, not yet integrated into chat or deployed**. This is
not a claim that today's public AI routes enforce these controls.

## Implemented foundation

- Existing S4 `AiCreditAccount`/`AiCreditEntry` balances are the source of truth.
  SANDBOX, LIVE and DEMO accounts are separate even when environments share a DB.
- Reserve a server-owned credit quote **before** calling any provider. A guarded
  balance update and the ledger entry commit in one transaction. Negative balances
  are also forbidden by the database, not only application code.
- A request ID is scoped to the actor/environment and single-use. Replays cannot
  start another provider call, even if the original reservation was refunded.
- Concurrent requests share the platform budget lock. Existing `DailyAiUsage` is
  checked and incremented atomically: 20 attempts/user/day; five for demo users.
  No owner exemption. Other legacy callers must be integrated before this daily
  quota is authoritative across every feature.
- The independent global provider-cost budget defaults to USD 5/day, can be
  disabled with `AI_PLATFORM_DAILY_BUDGET_USD=0`, and cannot exceed USD 10/day or
  500 attempts/day. It is shared across environments that share this database.
  Cost ceilings must come from a server-owned model allowlist and hard input/output
  caps. The budget cannot guarantee protection for providers/routes bypassing it.
- Provider failure refunds the user's credit reservation exactly once. Budget and
  attempt counters are **not** refunded: a timed-out request can still be billed.
- Reservations abandoned beyond two minutes are refunded on the account's next
  balance/read/reservation operation. Provider timeouts must be shorter than this
  lease. A late settlement cannot re-charge an already refunded reservation.
- Demo gets five credits once per isolated demo identity, not once per purchase.
  Existing demo-creation caps remain mandatory. Demo AI remains disabled until
  the complete generation path is guarded.
- BYOK reservations debit neither credits nor platform budget, but still consume
  the authenticated daily quota. Existing encrypted key storage is retained.

## Verification

`frontend/lib/ai-credit-ledger.test.ts` has nine configuration checks and ten real
PostgreSQL checks. The database tests opt in via `TEST_AI_LEDGER_DATABASE=1`, create
an unpredictable `qa_ai_ledger_*` schema, exercise concurrent transactions, and
drop only that schema afterward. They never call a provider or change public
users, balances, orders or daily counters. `AI_LEDGER_TEST_DATABASE_URL` can select
a dedicated test database; otherwise a local database URL is used without printing
it. A database account with schema-creation rights is needed for this opt-in test.

From `frontend/` in PowerShell:

```powershell
$env:TEST_AI_LEDGER_DATABASE='1'
npx vitest run lib/ai-credit-ledger.test.ts
```

Verified: simultaneous last-credit debits (only one succeeds); replay rejection;
duplicate failure refunds (only one); successful settlement cannot be refunded;
crashed-request recovery; demo grant concurrency; daily quota; concurrent platform
budget exhaustion; BYOK isolation; database negative-balance and hard-budget checks.
Result: **19/19**, TypeScript and touched-file lint passed.

## Release gates still open

1. Server-owned model/price ceilings, strict total input-byte and output-token caps.
   Unknown models fail closed for platform funds; missing provider keys disable UI.
2. Integrate main chat, participant generation, title generation, poll generation,
   answer verification and voice routes. No alternate unmetered platform path.
3. Propagate timeout, provider SSE error, empty stream and user disconnect to
   settlement. Bound response sizes and stop upstream work on cancellation.
4. Replace legacy order-minus-usage entitlement calculation; display current ledger
   balance, per-model credits and zero-balance purchase CTA; enable bounded demo AI.
5. Apply additive migration, run one real bounded debit and one zero-balance denial
   locally, then deploy and repeat in the actual UI. Provider calls are not yet
   covered by the foundation tests.

## Official model research

Checked the current [Vercel model catalog](https://ai-gateway.vercel.sh/v1/models)
and [GPT-6 Astra model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra).
An official model ID does not establish this project's account access. Verify
access before enabling a model. Output ceilings must include invisible/reasoning
tokens, not just visible text: [OpenAI token-counting documentation](https://developers.openai.com/api/docs/guides/token-counting).
