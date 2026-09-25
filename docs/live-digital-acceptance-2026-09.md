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

After the owner questioned refunding an already downloaded file, the agent
explained that this was a controlled reversal test, not automatic refund approval.
The Live purchase/access must remain intact unless the owner explicitly approves
that particular refund. Resolving the balance alone is not authorization.
The current seller-review screen exposes recorded file requests and retained
consent. Approving review changes only the review record; direct `REFUND` requests
return 409 even for admins. A fresh 42-case seller-return/security/acknowledgment
test run passes. No automatic after-download refund policy was added.

The application email row is ACCEPTED_UNCONFIRMED because its sending-only key
cannot retrieve delivery history. On 25 September the authenticated Resend
dashboard independently confirmed the matching message as Delivered, with the
original terms/consent attachment and SMTP 250 response. Its mail-server acceptance
preceded both first file requests. This is delivery evidence for this purchase,
not proof that a human read it or legal certification. No resend or manual database
status change was performed. See [exact timeline and boundaries](email-delivery-events-2026-09.md).

The `PaymentWebhookEvent` table has no entry for this capture, but this showcase
listener does not write capture events to that legacy table. Absence there is
not evidence of webhook failure or success. Server-verified capture establishes
fulfillment; actual Live refund delivery still needs its own proof.
