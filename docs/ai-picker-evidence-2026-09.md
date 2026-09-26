# AI picker and whole-row reordering — 26 September 2026

Status: local verification complete; hosted verification pending. Full-route readiness
remains incomplete. No schema, PayPal, purchase-price or credential changes.

## Changes

- Model picker is a bounded, centered panel (maximum 576×640 CSS pixels), with
  viewport/safe-area margins, four rounded corners and semantic gray borders.
  Only the list scrolls. Search, close and balance remain reachable in landscape.
- Search accepts display names, provider names and API ids, shows an empty state
  and resets when closing/selecting. Search resets the list's scroll position so
  results are not clipped by a previous scroll. Condensed rows retain 44px targets.
- The homepage and full chat share one neutral focus boundary; the inner
  textarea no longer draws a second green rectangle. Keyboard focus is retained.
- Drag anywhere on a conversation row/title to reorder. The grip is removed.
  Normal click opens the conversation; Alt+Up/Down and menu Move up/down provide
  keyboard/touch alternatives. Ordering stays account-scoped in local storage;
  search results are not reorderable. No server conversation data is changed.
- Catalog adds verified Grok 4.5/4.6, GPT-6 Sol/Luna and missing current/older
  text-chat entries for Claude, Gemini and Groq. It is a curated chat catalog,
  not every specialized/audio/image/agent endpoint offered by each provider.
  Existing defaults are preserved. New catalog entries alone do not authorize
  platform spending. Provider-account access is still required for BYOK.

## Grok spending boundary discovered during research

xAI's [Chat Completions reference](https://docs.x.ai/developers/rest-api-reference/inference/chat-completions)
states that its completion-token limit only applies to visible output, excluding
reasoning. Its [Responses reference](https://docs.x.ai/developers/rest-api-reference/inference/responses)
states that `max_output_tokens` covers both. These parameter descriptions were
read from the official pages' `.md` representations; the HTML extraction omitted
them. Grok now uses Responses with `max_output_tokens: 2048`, low reasoning,
`store: false`, no tools/search and bounded input. No automatic retries.

The parser emits only text deltas, requires an explicit completed response, and
refunds failed, incomplete, missing-terminal or over-budget responses. A bare
`[DONE]` is insufficient. Reasoning content is not displayed or saved.

Grok 4.5/4.6 each use 8 credits and an 80,000-microUSD reservation. The reviewed
$2/M input and $6/M output price gives a conservative bound of 66,624 microUSD
including a 2× margin over 10,000 input bytes + 512 framing tokens and 2,048 total
output/reasoning tokens. Existing atomic reservations, zero-balance blocking,
daily fuses and pricing-review expiry are unchanged. Grok 4.7 uses the same
safer API. No new automatic top-ups or customer credit grants.

## Verification and limitations

- Baseline regressions reproduced picker clipping, the inner focus outline and
  missing whole-row keyboard/drag behavior. Whole-row click, drag, menu move,
  keyboard move, reload persistence and independent drafts are exercised.
- Initial focus assertions were corrected to inspect painted outline style
  (Chromium reports a width even with `outline-style: none`) and to wait for
  dialog dismissal before clicking the composer. The assertions still check a
  visible replacement focus boundary.
- 76 focused catalog, reservation, streaming and rail-order unit tests pass.
  Separate ledger run: 9 pure tests passed; 23 database integration tests were
  skipped without the isolated database test flag, not counted as acceptance.
- Strict production build/TypeScript and touched-file lint pass. Local browser
  coverage includes 12 cases in each light/dark theme at 360, 390, 844 landscape,
  768, 1024 portrait, 1280, 1920 and 2560 CSS pixels. The tests mock generation
  and conversation writes; they do not spend customer credits. Real Chrome
  independently verifies the signed-in picker and selection on localhost.
- Real configured xAI account lists Grok 4.5, 4.6 and 4.7. Each passed a capped
  256-token Responses smoke call, with nonempty text and completed status.
  Returned output/reasoning token counts: 4.6 = 52/51, 4.5 = 12/11, 4.7 = 26/25.
  No customer balance was debited. These smoke calls are provider evidence,
  not a new end-to-end customer purchase/ledger test.
- OpenAI authenticated catalog confirms the added OpenAI ids. Claude/Gemini/Groq
  additions were checked against official documentation, not successful calls
  with a customer's BYOK. Anthropic is not configured in the local QA launcher.
  New entries remain BYOK unless explicitly present in the reviewed allowlist.
- Design-guideline review drove semantic border tokens, bounded scrolling,
  retained keyboard focus and alternative reordering controls. No new UI system.

## Catalog sources

- [Grok 4.5](https://docs.x.ai/developers/models/grok-4.5) and
  [Grok 4.6](https://docs.x.ai/developers/models/grok-4.6).
- [OpenAI model catalog](https://developers.openai.com/api/docs/models),
  [GPT-6 Sol](https://developers.openai.com/api/docs/models/gpt-6-sol) and
  [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).
- [Claude current models](https://platform.claude.com/docs/en/models/overview).
- [Gemini lifecycle](https://ai.google.dev/gemini-api/docs/deprecations): older
  2.5 models require prior project access; shutdown entries were not added.
- [Groq models](https://console.groq.com/docs/models): Llama enterprise entries
  explicitly label their access requirement; specialized safety/audio excluded.
