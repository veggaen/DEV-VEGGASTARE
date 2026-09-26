# Conversation management acceptance — 26 September 2026

Status: **local verification passed; hosted checks pending. Not an all-messaging certification.**

## Scope

`/conversations`, `/conversations/[id]`, management GET/PATCH/DELETE, and the
conversation-list/private-visibility boundary. No migration, payment, price,
credit, credential or billing change.

- Writes require exact same origin, bounded validated input, current identity
  and session version, and both durable and burst throttling. Demo and
  impersonation sessions cannot mutate conversations.
- Identity then conversation row locks serialize edits, deletion, cancellation
  and concurrent retries. Only the creator or current administrator manages a
  thread. Nullable fields really clear; unknown fields fail closed.
- Direct/group chats cannot be made public by PATCH. Older misconfigured rows
  also remain private on direct reads and before list pagination. Nested repost
  previews require their own access check. Narrower legacy visibility remains
  restrictive; this is not a blanket participants-access migration.
- Pending-deletion private threads disappear from other participants' inboxes.
  Repeated requests preserve the original deadline; cancellation restores access
  only before the deadline. Lost-response retries do not restart deletion.
- Responses use an explicit DTO and private/no-store caching. Realtime sends
  only invalidation, and a notification outage does not fail a committed write.
- Failed delete/cancel operations have visible retry feedback. The confirmation
  says deletion affects everyone. OWNER controls now work; read-only demo has
  no destructive controls. The nonfunctional local-only Mute option was removed.
- Pending-deletion composers stay mounted but disabled, preserving the draft.
  Notices align with the transcript and wrap at phone widths; errors are legible
  in light and dark themes. Design/testing guidance informed these checks.

## Verification record

151 focused unit/API tests, touched-file ESLint, strict production build/TypeScript
and all 22 local browser cases pass. The real isolated-database lifecycle test
passed in 18.4 seconds. Hosted checks remain pending. Local evidence is under
`frontend/test-results/conversation-management-local-privacy-final` and
`frontend/test-results/conversation-management-db-final` (ignored artifacts).
The wider regressions include message reads, header previews, subscriptions and
private-channel authorization. The old public-subscription fixture incorrectly
used a GROUP type; it now uses PUBLIC_THREAD, with explicit legacy private-type
denial cases for both guests and non-members.

The database test creates only random disposable password users in the isolated
Preview database. It verifies creation/replay, foreign-owner denial, bad origins,
legacy-private feed/repost exclusion, concurrent scheduled deletion/cancellation,
message cascade, session revocation, and cleans up those fixtures. It must never
run against Production.

The 22 scoped browser cases cover creation/retry, delete/cancel failure recovery,
read-only controls, HTTP denial and inbox layouts at 360, 390, landscape, 768,
1024, 1280, 1920 and 2560. Management dialogs run in light/dark at 390/1280.
Hosted writes are intercepted fixtures; actual write evidence comes from the
isolated database. No real customer conversation is deleted or messaged.

## Remaining acceptance

Reaction/repost mutations, moderation flags/pins and other metadata endpoints
still need their own fresh security and interaction pass. Historical private
attachments, physical-phone keyboard behavior and native 125% zoom remain gaps.
The route ledger and full production scoreboard remain PARTIAL.
