# AI credit safety

Status: **deployed; demo debit, persistence and zero-credit denial verified locally and live**.
The additive reservation migration is applied. Release `cd99962`, deployment
`dpl_DMGSUQQ1DPgCfG1FUfvp955WHQtJ`, is READY at https://www.veggat.com.

## Spending invariants

- Existing S4 `AiCreditAccount`/`AiCreditEntry` balances are the source of truth.
  SANDBOX, LIVE and DEMO accounts remain separate even when they share a database.
- Reserve a server-owned credit quote **before** any provider request. A guarded
  balance update and ledger entry commit in one transaction. Database constraints
  also forbid a negative balance.
- Actor/environment-scoped request IDs are single-use, including after a refund.
- The global budget lock serializes spend reservations across replicas. Existing
  `DailyAiUsage` is checked/incremented atomically: 20 attempts/account/day; five
  for demos. BYOK consumes the daily quota too. No owner exemption.
- The independent global provider-cost allowance defaults to USD 5/day.
  `AI_PLATFORM_DAILY_BUDGET_USD=0` stops platform calls; malformed configuration
  fails closed. Database/application ceilings are USD 10/day and 500 attempts/day,
  shared across environments using the same database.
- Budget is a conservative **reserved ceiling**, not a precise provider invoice.
  It is never refunded on timeout, failure, or cancellation because a failed
  request may still cost the provider money.
- User credit reservations refund once on provider failure, empty/incomplete/error
  streams, timeout or early cancellation. Abandoned reservations older than two
  minutes recover on the account's next balance or reservation operation.
- Text input is capped at 10,000 UTF-8 bytes including the system prompt, with at
  most 20 recent messages; output is capped at 2,048 tokens including reasoning
  where supported. No tools, images, search or other separately billed operations
  are requested. Upstream timeout is 40 seconds; responses are size-bounded.
- A completed, nonempty terminal stream settles success. Structured poll output
  is validated before settlement. There are no automatic billable retries.
- The reviewed price/model allowance expires **2026-10-24 UTC**. Review official
  price cards and caps before extending it; expired/unlisted models fail closed
  for platform spending. BYOK is not charged to this budget.

## Integrated paths

Main chat, participant replies, experimental poll generation, answer verification
and dictation cleanup use the same generation boundary. Titles use the first
message locally and incur no extra AI call. Poll preview output is limited to
three questions to fit its explicit generation budget.

Audio transcription is **BYOK-only** until server-verified audio duration can
bound platform costs. It uses a saved personal OpenAI key, upload/time limits and
the shared daily request quota. No platform OpenAI audio key fallback remains.

The legacy order-minus-usage entitlement calculation now reads the ledger.
Provider key availability and saved-provider metadata are returned without keys;
unavailable models are disabled. Saved-key decryption failures do not silently
switch to platform billing. Keys remain encrypted using the existing key store.

Demo gets five credits once per isolated identity on its first guarded generation;
free platform models cost one demo credit. Demo identity-creation caps remain in
force. Demo conversations stay private, have a five-session cap, and cannot add
personal keys or make real purchases.

## Model allowance

Credits are a disclosed flat price per message, not an exact token bill. Normal
accounts can use configured free models at zero credits within daily limits.

| Model | Credits | Conservative platform reservation |
| --- | ---: | ---: |
| Gemini 2.5 Flash Lite | 0 | USD 0.005 |
| GPT-OSS 20B on Groq | 0 | USD 0.004 |
| Ling 3.0 Flash via Vercel | 0 | USD 0.001 |
| GPT-5.6 Luna | 2 | USD 0.015 |
| GPT-6 Astra | 60 | USD 0.600 |
| Grok 4.7 | 8 | USD 0.080 |
| Claude Sonnet 4.6 | 16 | USD 0.160 |

Configured project model-list APIs confirmed OpenAI Luna/Astra, Groq GPT-OSS 20B
and Grok 4.7 IDs. A listed model is not evidence of a successful generation.
Anthropic is disabled without a configured platform key.

## Verification

- **19/19** ledger tests: last-credit concurrency, replay rejection, duplicate
  refunds, no refund after successful settlement, lease recovery, one-time demo
  grant, daily cap, budget races, BYOK isolation and database constraints.
- **63/63** generation/stream/request/demo-policy tests: reserve before provider
  call, insufficient-credit denial without spend, saved-key failure isolation,
  malformed/oversize/empty/error streams, cancellation, timeout and origin/body
  guards. **107/107** with the selected payment regression files.
- Final local production build, TypeScript and touched-file lint passed. Focused
  Playwright **5/5** (49.2s, including setup): AI drawer/transcript reflow at eight
  sizes, real Groq debit to zero and subsequent premium denial, Pulse/footer/drawer
  scrolling and anonymous model selection. Earlier real OpenAI sends debited two
  credits and exposed a response-shape bug; the saved reply now reloads correctly.
  No test allowance or daily counter was reset.
- Live real-provider browser check **2/2** (37.7s including setup): two OpenAI Luna
  replies and one Groq reply persisted, exhausting the existing five-credit demo
  grant; a subsequent premium request returned 402. Live non-spending AI/layout,
  Pulse and marketplace regressions **6/6** (55.6s). Current Astra/Grok paid
  generations are not covered by this demo allowance and are not claimed tested.

The database tests opt in, create a random `qa_ai_ledger_*` schema, and remove only
that schema afterward. They never call providers or change public balances/orders.
`AI_LEDGER_TEST_DATABASE_URL` can select a dedicated database; otherwise the
configured local URL is used without printing it.

```powershell
# In frontend/; requires rights to create an isolated test schema.
$env:TEST_AI_LEDGER_DATABASE='1'
npx vitest run lib/ai-credit-ledger.test.ts
```

The real-provider Playwright check requires `E2E_AI_REAL=1` and a retained
app-issued demo storage state. It spends only that account's existing allowance,
does not reset counters, and verifies saved replies and the zero-credit error.
Normal CI does not make these paid provider calls.

## Release gates

Paid credit purchase remains separately blocked by missing PayPal credentials;
demo generation is not proof of paid capture. Verify the paid models after a
verified purchase, without manually changing balances or bypassing quotas.

## Official references

[Model catalog](https://ai-gateway.vercel.sh/v1/models),
[GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra),
[OpenAI token counting](https://developers.openai.com/api/docs/guides/token-counting),
[Groq model documentation](https://console.groq.com/docs/models),
[Grok 4.7](https://docs.x.ai/developers/models/grok-4.7).
