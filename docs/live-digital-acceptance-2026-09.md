# Live digital purchase — 25 September 2026

The owner approved the one-time **29 NOK** artwork purchase using their buyer
PayPal account. The agent did not approve the payment or submit a refund.

- Order: `cmug9nlar000204l0bjkgz91o`.
- Capture: `0RV7577637864821N`.
- Read-only production database verification: environment LIVE, 2,900 ore, NOK,
  attempt COMPLETED, order COMPLETED, refunded amount zero.
- Real Chrome returned to the confirmed receipt and downloaded both files using
  its ordinary signed-in owner session. No session cookies were exported.
- `fjord-study.jpg`: 539,906 bytes; `fjord-study-guide.txt`: 2,201 bytes. Both
  SHA-256 hashes equal their stored asset checksums. The actual JPG was visually
  inspected, and the guide accurately identifies the 1536 × 1024 AI artwork,
  wallpaper setup and personal-use terms.
- Exactly two download entitlements exist, each used once, neither revoked.
  Both raw storage requests return 403; anonymous signed-download requests return
  401; the retained unrelated demo account receives 403 for each signed download.
  Tokens and raw storage URLs were kept out of logs and this document.
- The confirmed receipt is retained in real Chrome. No new credit grant occurred.

## Remaining acceptance

Live refund/revocation is **BLOCKED on the owner's available merchant balance**.
After owner sign-in, PayPal's exact transaction detail confirms the artwork,
invoice/order ID and 29 NOK gross amount (3.79 NOK fee, 25.21 NOK net). The
merchant dashboard shows the payment held and zero available balance.
Opening the refund review displays: "Du har ikke nok penger i PayPal-saldoen
til å dekke denne refusjonen" (insufficient available balance for the refund).
No refund was submitted, money added, bank linked or hold workaround attempted.
The exact refund review is retained for the owner; do not refund the older
ten-credit purchase by mistake. Funding or hold resolution requires owner action.

Transactional email is ACCEPTED_UNCONFIRMED. One send was accepted; the subsequent
provider receipt lookup returned 401 (the code explicitly supports sending-only
keys). This does not establish human inbox delivery. Do not resend a successfully
accepted message merely because retrieval is unavailable, or expand key access
without approval. The downloadable original confirmation remains available.

The `PaymentWebhookEvent` table has no entry for this capture, but this showcase
listener does not write capture events to that legacy table. Absence there is
not evidence of webhook failure or success. Server-verified capture establishes
fulfillment; actual Live refund delivery still needs its own proof.
