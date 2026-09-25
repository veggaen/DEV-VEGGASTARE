# Transactional delivery evidence — 25 September 2026

## Verified existing Live purchase

The authenticated Resend dashboard shows **Delivered** for the artwork receipt
`01a0d620-1dcf-7112-a02c-26eb0885210a`, matching the saved provider ID for order
`cmug9nlar000204l0bjkgz91o`. Its original text and attachment contain the same
order, capture, 29 NOK amount, delivery request, full versioned Norwegian sales
terms and optional withdrawal form. The receiving mail server returned SMTP 250.
No resend, refund, purchase or permission change was made to obtain this evidence.

The scoped, read-only database check and observed SMTP timestamp give this order:

| Event | UTC, 25 September 2026 |
| --- | --- |
| Consent record | 01:12:36.193 |
| Verified purchase | 01:13:43.123 |
| Provider acceptance | 01:13:43.785 |
| Receiving mail server acceptance | 01:13:45 |
| First JPG request | 01:14:13.196 |
| First TXT request | 01:14:27.858 |

Each file still has one recorded request and is not revoked. This establishes
mail-server delivery before the recorded file requests for **this purchase**;
it does not prove a human opened the email or that all legal requirements are
satisfied. The diagnostic explicitly interprets Prisma timestamps as UTC and
verifies database TLS. No private file tokens or email credentials are logged.

The existing application row remains `ACCEPTED_UNCONFIRMED`: its sending-only
key cannot retrieve provider history. Dashboard observation is not written back
as an invented webhook or used to alter customer rights.

## Signed event implementation

- `/api/webhooks/resend` uses Svix 2.5.0 to verify raw request bytes and the
  signature timestamp before parsing. Missing `RESEND_WEBHOOK_SECRET` fails
  closed. Declared and streamed payloads are limited to 64 KiB.
- Handles only delivered, bounced, failed, suppressed and complained events.
  Open/click tracking is not enabled or required. Sender, recipient, subject,
  provider ID and environment must match the immutable queued message.
- New messages retain random outbox-ID/environment tags. These allow an
  authenticated event to arrive before the sender saves its response. Old
  messages remain byte-for-byte unchanged and match only their saved provider ID.
- Three nullable evidence columns preserve the latest event time/type/ID;
  first confirmed delivery time is retained separately. A per-message
  transaction lock serializes concurrent events and dispatch lease claims. Older events cannot overwrite
  newer failures; negative events take precedence when timestamps tie.
- A verified event clears an in-flight lease. Its stale sender/poller response
  cannot overwrite evidence or trigger another send. No payment, credit,
  download entitlement, original agreement or refund field is mutated.
- No raw webhook payload, recipient, signature, key or provider error body is
  logged. Database failures return a retryable response rather than success.

## Verification and release

59 focused unit checks pass. Four isolated Postgres cases pass; the optional
real-provider send is deliberately skipped. The database concurrency test
caught that an unqualified raw row lock did not target Prisma's isolated test
schema. It was replaced with the existing transaction-advisory-lock pattern;
eight concurrent events now yield one update and seven duplicates. Another real
database case runs eight competing workers, receives delivery before the sending
response, then fails that response: evidence survives and there is still one send.

Touched-file lint passes. The additive migration is applied to the isolated
Preview database only. The first strict build caught and corrected a test-only
header-union type error; the final strict build/TypeScript passes with the
shared-claim lock and the existing EdgeStore postinstall patch applied. Initial local browser acceptance found no completed
order in the retained demo account. Normal free-demo checkout prepared that
fixture without a payment or provider generation; the receipt and protected-job
checks then passed (2/2, 3.5s), repeated on the final build (2/2, 5.1s, no retries).
The receipt check covers eight sizes in both themes,
original-record download and support-form cancellation, with no payment writes.
An actual unsigned HTTP POST returns 503/no-store while the webhook is unconfigured.
Real Chrome refreshed the paid Live receipt and confirms its unchanged completed
purchase and truthful unconfirmed-email status; no extra file download occurred.
Production deployment and provider registration are **not yet complete**.
The Resend form is prepared with five delivery-event types but remains unsaved.
Creating its signing secret and sending metadata to the app requires action-time
owner confirmation. The existing sending API key is not replaced or broadened.

## Boundaries

Mail remains asynchronous. The app does not guarantee that every future email
arrives before a buyer first downloads. This evidence feature does not implement
a legal waiver, automatically reject refunds or retroactively collect consent.
Human inbox confirmation and Norwegian legal review remain distinct acceptance
items. No real refund is authorized by this work.

Primary references:
[Resend verification](https://resend.com/docs/webhooks/verify-webhooks-requests),
[delivery event](https://resend.com/docs/webhooks/emails/delivered),
[event types](https://resend.com/docs/webhooks/event-types),
[retries](https://resend.com/docs/webhooks/retries-and-replays).
