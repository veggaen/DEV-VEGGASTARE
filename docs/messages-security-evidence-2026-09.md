# Messages write and realtime acceptance — 26 September 2026

## Scope

Human-to-human Messages only; this is not a claim that the full messaging system
or production app is finished. Payment logic, balances, prices and schema are
unchanged. The production-safe tree still has 56 migrations; integrated Preview
retains its separate pending payment/schema work.

- Message create/edit/delete require same-origin requests, current database
  identity/version, read permission, applicable reply/ownership rules and two
  rate-limit budgets. Bodies and attachment URLs are bounded and validated.
- Conversation-row locking serializes writes and reply counters. A client UUID
  becomes a per-user deterministic message ID, so a retry after a lost response
  does not create a second message. Old clients without a UUID remain supported.
- Parent replies must belong to the same conversation. Post-commit realtime
  failure does not misreport a saved message as failed.
- Conversation and user-notification channels now use authenticated, environment-
  scoped `private-` names. The authorization endpoint checks current identity and
  read access. Message events contain only an empty invalidation, even for public
  posts. Already-authorized sockets cannot receive subsequent message content
  after membership/visibility changes. Public statistics use an explicit numeric
  allowlist. Browsers obtain content from the authorized HTTP route.
- Private quoted conversations are omitted from public message responses. Reads
  have private/no-store caching. The default deletion preference does not hide
  ordinary conversations; it applies only after a deletion request.
- Edits update locally; deletion requires confirmation and handles failure.
  Failed sends retain drafts and reuse the request identity. Draft keys include
  account and thread; IME composition does not submit on Enter. Private human-chat
  image upload controls and API writes are disabled because their existing
  storage bucket is public. AI-chat images use their separate private pipeline.

## Local evidence

- 90 focused unit/API tests pass. An initial test reproduced the non-viewer reply
  vulnerability before the permission-helper fix. Schema review caught and fixed
  the default deletion-preference compatibility issue before browser acceptance.
- Strict production build and TypeScript pass. Lint on touched files has no
  errors; two pre-existing internal-navigation warnings remain in Pulse files.
- 17 conversation recovery/layout/race tests, four message-control tests
  (360/1280, light/dark), and three existing realtime/cart checks pass with no
  retries/skips. Failure fixtures intercept writes; they never mutate hosted data.
- Actual HTTP/Playwright acceptance against the isolated Preview database creates
  three disposable ordinary users and two private threads. It verifies outsider
  rejection, cross-origin rejection, simultaneous duplicate request deduplication,
  exact counters, cross-thread parent rejection, edit/delete ownership and private
  attachment rejection. Two actual browsers exchange, edit and delete a message
  through Pusher. Cancelled deletion does not delete. A deliberately lost response
  retains the draft and its retry leaves exactly one database row. Removing a
  participant denies read/write/new authorization and clears their open viewer
  after the next body-free event. Test records are removed in `finally`; no
  production user, message, payment or credit is changed.
- Actual local no-overflow checks and screenshots: 360, 390, 844 landscape, 1280
  and 2560. Screenshot inspection confirms the pinned composer. Physical keyboard
  and actual 125% desktop zoom remain outside this evidence.
- Real Chrome remains connected and the signed-in local New Conversation form
  reloads correctly. No user-account message was submitted for this check.

Ignored evidence: `frontend/test-results-message-security-local`,
`test-results-messages-security-recovery-local`, `test-results-message-controls-local`
and `test-results-message-security-realtime-local`. Local integration helper:
`frontend/.private-showcase/test-messages-http.mjs` (never deployed).

## Hosted acceptance

Pending. Do not infer deployment from local verification.

## Remaining release gates

New private human-chat image uploads are unavailable; historical public-storage
attachments are not migrated/revoked by this patch. Conversation-level create/
delete/moderation, reaction and notification endpoint hardening remains separate.
Message history is still unpaginated; offline/reconnect UX and deleted-message
idempotency tombstones need follow-up. Existing administrator read/moderation
policy is unchanged. Public statistics may be briefly stale. Full route audit,
provider/payment work and remaining scoreboard blockers are not complete.

The testing skill guided focused failure and real-browser checks. Protocol
references: [Pusher private channels](https://pusher.com/docs/channels/using_channels/private-channels/),
[channel authorization](https://pusher.com/docs/channels/server_api/authorizing-users/),
and [official browser SDK](https://github.com/pusher/pusher-js).
