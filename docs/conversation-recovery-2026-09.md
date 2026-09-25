# Conversation detail recovery — 26 September 2026

## Reproduced defect

An HTTP 503 from `/api/messages?conversationId=…` was rendered as “Conversation
not found,” with no retry. The focused browser regression failed on the old build
at both 390 and 1280 pixels. This is distinct from a genuine missing record.

## Correction

- Read failures show a short error and retry; 401/403/404 share an unavailable
  state without disclosing whether an inaccessible conversation exists.
- Successful responses must contain the requested conversation and message/user
  arrays. Invalid JSON or malformed envelopes become recoverable errors.
- A new read aborts the previous one. Unmount aborts outstanding reads, and
  aborted responses cannot commit data or clear a newer request's loading state.
- Account/conversation identity keys reset local state on changes. Failed reads
  clear conversation/messages/users/poll state; realtime subscriptions only start
  after a readable conversation is loaded. Typing timers are cleared on unmount.
- Background successful message refreshes do not replace the composer with the
  initial-loading spinner.

## Evidence and limits

Production build, TypeScript and touched-file ESLint pass. Four local browser
checks pass in 5.5 seconds, no retries/skips: 503 → retry → 404, and 503 → retry →
valid group conversation, each at 390/1280; back navigation, no page errors and no
horizontal overflow are asserted. A retained isolated demo session is used;
message reads are intercepted. No message or conversation is created/deleted.

Hosted acceptance, explicit stale-response race regression, real populated
conversation fixtures and members-panel responsive interaction remain pending.
Do not treat these four tests as acceptance of all conversation features.
