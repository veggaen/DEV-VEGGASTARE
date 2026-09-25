# Unpaid order recovery

## Behavior

My orders exposes Continue payment and Cancel unpaid order outside the collapsed
details. Cancellation requires confirmation, checks PayPal, retains the financial
record and cart, and does not restore daily purchase limits. Paid orders keep
their receipt; downloads are offered only when the order has download records.
Price explanations are collapsed rather than repeated above every order.

Resume reuses the immutable checkout and PayPal request IDs. It never creates a
second cart purchase. A completed provider order is independently verified and
reconciled instead of asking for payment again. The original one-hour/UTC-day
capture window still applies. Expired unpaid links return the buyer to their cart.

Capture and cancellation use competing database state claims. Unknown network
outcomes remain CAPTURE_PENDING/CANCEL_PENDING and can be retried safely. A
verified existing capture can still reconcile after local cancellation; no funds
are silently ignored and cancellation never invents a refund.

## Verification, 25 September 2026

- 49 focused recovery/fulfillment/order-presentation unit cases pass.
- Three real isolated Postgres tests pass: 12 simultaneous capture/cancel races,
  required completion proof, rejection of cancellation with a capture ID, and
  unpaid cancellation without invented proof. Disposable test schema removed.
- Strict local build/typecheck and touched-file lint pass.
- Focused Playwright flow passes on localhost:3000: resume to mocked PayPal,
  Keep order makes no request, uncertain provider response stays retryable,
  confirmation cancels, paid-only actions disappear. Screenshots and overflow
  checks cover 360, 390, 844 landscape, 1024 portrait, 1280 and 2560 widths.
- Real Chrome cancelled the existing expired Sandbox order ending 2ZKCJ8P8.
  The record remains visible as Cancelled; the paid order and cart are unchanged.
- Local/Preview database migration applied; production deployment is pending.

## Rollout

Apply `20260925030000_checkout_recovery_states` before deploying this code. It
extends state constraints while retaining verified completion proof and adds an
unpaid-only cancellation constraint. No columns or historical records are deleted.
Upgrade all checkout servers sharing that database before allowing cancellations;
older code does not understand cancellation claims. Do not roll back to code
without these guards once cancellations have been accepted.

PayPal Orders v2 does not expose a cancel-order endpoint. This cancellation blocks
Veggat's capture path; it does not claim to revoke a PayPal approval URL globally.
Independent verified captures/webhooks are still reconciled. Reference:
[PayPal Orders API](https://developer.paypal.com/api/orders/v2).
