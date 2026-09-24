# Buyer notices and retainable acknowledgments — 24 September 2026

## Scope and boundaries

The verified checkout receipt now exposes **Withdraw from this purchase** and
**Report a purchase problem**, with an explicit second confirmation, optional
message, keyboard focus, draft retention on failure, and support contact fallback.
An existing defect report does not prevent a separate withdrawal notice. Pending
requests, seller responses and original downloadable acknowledgments remain on
the receipt, including after payment status changes. Demo orders explicitly say
no payment was collected; the flow does not create a payment or refund.

This is **not** a rule denying refunds after a download. Nor does sending a notice
establish that a refund is due or that money moved. The existing verified PayPal
reconciler alone handles revoked credits/downloads. An original submitted message
and UTC timestamp are retained; review status and seller notes do not rewrite the
downloadable acknowledgment. Raw asset tokens are not included.

POST validates strict input, origin, authenticated ownership and durable rate
limits. A transaction takes the same order lock as payment reconciliation and
serializes pending requests of the same kind. Identical active retries return the
original request; a conflicting message cannot overwrite it. Another pending
request type does not block withdrawal. Closed requests can be followed by a new
notice; this is not a promise of eternal exactly-once delivery for every retry.
The acknowledgment endpoint is buyer-only, throttled, private/no-store, UTF-8
plain text, `nosniff` and attachment-only. No new schema or migration is needed.

The demo mutation allowance is exact `/api/returns`; `/api/returns/:id` seller
review and payment mutations remain blocked. The route separately verifies that
the demo actually owns the completed order. No account or financial caps changed.

## Verification

- Touched ESLint and strict production-style local build/TypeScript pass.
- Payment/demo units: **190 passed**, four opt-in tests skipped in this ordinary
  run. The three new concurrency cases passed separately against isolated Neon.
- Real PostgreSQL: eight concurrent notices create one pending row; conflicting
  messages remain unchanged; a defect notice and withdrawal can coexist; replay
  after an order cancellation retrieves the original; a foreign buyer is denied.
  Only a random `qa_buyer_requests_*` schema was created and removed. No public
  data, credits or financial transactions were touched. Initial QA harness runs
  exposed enum-cast incompatibility in the cloned tables; corrected enum copies
  and matching column types pass all three cases.
- Local Playwright: **2/2 (6.9s)**. The first UI journey intercepts request writes
  to test failure/retry/focus and geometry at 360, 390, 844 landscape, 768, 1280
  and 2560. Screenshots at 390/1280 were visually inspected. The second uses an
  existing, explicitly unpaid demo order: two actual concurrent requests return
  the same ID, anonymous acknowledgment access fails, a real browser TXT download
  matches the original, and reloading keeps the notice and original order status.
- The initial real demo POST was blocked by the demo guard; the exact scoped
  allowance was added and tested, then the local build and both journeys rerun.

## Not claimed

No Live refund or paid withdrawal was submitted by QA. Owner Live micro-purchase
acceptance remains pending. Purchase and request confirmations are downloadable,
**not emailed**. Transactional email/outbox delivery, the complete durable sales
agreement/withdrawal form, seller review operations, and Norwegian legal review
remain separate work. This slice does not assert compliance with the new §20a
electronic withdrawal provisions or their commencement date.

The content/services distinction and conditions for losing withdrawal rights are
discussed in the [Norwegian legislative explanation](https://www.regjeringen.no/no/dokumenter/prop.-50-ls-20222023/id2966742/?ch=8).
The new electronic function is described in [Lovvedtak 85, section II](https://www.stortinget.no/no/Saker-og-publikasjoner/Vedtak/Beslutninger/Lovvedtak/2025-2026/vedtak-202526-085/?m=0).
These sources inform safeguards; they do not certify Veggat's implementation.
