# AI chat canvas — 26 September 2026

Status: local acceptance passed; hosted acceptance and image attachments pending.
This is not certification that all Veggat routes are production-ready.

## Scope

- `/ai` opens a usable, centered new-chat composer without a welcome menu.
  Viewing it creates no database conversation and makes no generation call.
  The first Send creates a conversation; a failed provider request can retry
  the same conversation without losing the original draft.
- The homepage retains its marketplace story and uses the same compact composer.
- Separate account-scoped, in-memory text drafts survive navigation between
  AI conversations. Drafts are not uploaded, put in URLs or persisted to browser
  storage. They do not yet survive a browser reload or leaving the AI layout.
- Chat order supports drag, Up/Down keys and explicit Move up/down menu items.
  Only ordered conversation IDs are saved locally, scoped by account. Ordering
  is not yet synced across devices; search results cannot be reordered.
- Assistant text supports safe Markdown, code blocks, tables and response copy.
  Raw HTML is skipped; remote Markdown images are links, not tracking-image loads.
- A private conversation requires explicit confirmation before public sharing.
  Failed changes or clipboard writes no longer produce a false success toast.
- Compact landscape composition preserves room for the transcript. The rail is
  adjacent to the app navigation; message width remains bounded on ultrawide.

## Boundaries

No payment, pricing, credit ledger, provider adapter, database schema, auth
cookie, or secret changes. `react-markdown` and `remark-gfm` load with transcript
rendering rather than the blank canvas. The full `npm audit` still reports 39
findings (31 moderate, 8 high); these require separate dependency triage.

Image/video generation remains in the existing Studio. Pasting/uploading images
into text chat is **not implemented in this slice**: the current backend accepts
text only. It needs bounded private uploads, supported-provider validation,
image-aware credit reservations, attachment draft isolation and end-to-end tests.
Do not represent image attachments as completed because text drafts work.

## Verification

- Four focused unit files: **13 tests pass**. They cover draft isolation, account
  changes, new-chat draft transfer, reorder bounds, rename recovery and Markdown
  sanitization. Touched-file lint passes.
- The browser suite intercepts AI generation/session requests. These are UI
  contract tests, not new live-provider success or billing evidence.
- Tested widths: 360, 390, 844×390, 768, 1024, 1280, 1920 and 2560. Assertions
  include visible composer bounds, visible transcript height, horizontal scroll,
  model dialog, independent drafts, retry and zero-balance premium blocking.
- Initial visual review caught inadequate transcript height in landscape;
  the layout and test were strengthened. Final acceptance is recorded below
  after rebuilding the exact candidate: **12/12 light and 4/4 targeted dark pass**,
  zero retries or skips. Production build/TypeScript and touched lint pass.
- Real Chrome local canvas inspected in the signed-in account. Its viewport
  override did not change measured dimensions; phone claims must use the
  separately sized Playwright browser, not that unsuccessful override.
- Real Chrome verifies new/existing-chat draft separation and the public-share
  confirmation (cancelled, nothing published). Temporary unsent QA text was
  cleared. No provider request or credit charge was made during this UI check.

## Design references

The supplied Grok, ChatGPT and Claude screenshots informed centered composition,
quiet surfaces, restrained hierarchy and contextual controls, not copied brands.
[Nielsen Norman Group](https://www.nngroup.com/articles/prompt-controls-genai/)
informed grouping and restraint. [WCAG dragging guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements)
informed non-drag alternatives. [react-markdown security guidance](https://github.com/remarkjs/react-markdown#security)
informed safe rendering. Web-design, composition and testing skills informed
the shared composer, account-scoped state and visual/interaction checks.
