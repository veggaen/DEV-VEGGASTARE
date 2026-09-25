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

Follow-up: the fixed 300px inline members panel reduced a phone composer from
356px to 56px. It now reuses the existing AI chat Sheet, with focus restoration,
44px trigger, safe-area padding, independent scrolling and no width animation.
Guideline review used the current
[Vercel interface guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md).

Expanded local browser acceptance passes 17/17 in 28.4 seconds, no retries/skips,
at 360, 390, 844 landscape, 768, 1024, 1280, 1920 and 2560 pixels. The composer
width stays unchanged while the sheet opens; closing restores focus. Screenshot
inspection confirms phone/landscape bounds. The stale-response regression proves
that leaving a held request aborts it and the next thread remains visible after
the old transport response is released. All data are intercepted fixtures.

Hosted acceptance and real populated conversations remain pending. This is not
acceptance of all messaging/voice functions. Separate audit finding to reproduce:
the inbox's Edit action links to a route not present in the current route tree.
