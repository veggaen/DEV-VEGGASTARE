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
- Migration applied to isolated and production databases. The deployed source is
  `3d29861`; local, Production and Preview strict builds/typechecks pass.
- Production `dpl_B5uj2WYZ2s5kfaigvtV58DtQBaQv` promoted to www.veggat.com after its
  authenticated candidate health check passed. Preview
  `dpl_DmeQLPLQntt4NQzuEVNy7PRuNrY4` is assigned to the existing stable Sandbox
  Preview hostname; its health check also passed. No billing or gate changes.
- Two focused Playwright tests pass in each of local, Live and Preview: responsive
  mocked recovery flow plus actual endpoint rejection of anonymous, foreign-origin
  and demo mutations. Ownership checks additionally pass in service unit tests.
- Real Chrome Live inspection confirms the unpaid expired order has a cancellation
  confirmation, Keep order leaves it untouched, and the paid order remains verified.
  No Live cancellation, new purchase or refund was made.
- Actual Sandbox resumption subsequently passed locally and on stable Preview.
  The existing password QA buyer created an unpaid artwork order, left PayPal,
  used Continue payment in My orders, and reached the real PayPal login/approval
  screen with the identical provider approval URL. Cancellation then passed.
  Local order `cmug92zx20005rct54tz4ojct` and Preview order
  `cmug95lg3000004l3bmieyk1e` each remain CANCELLED with no capture, credit grant or
  download token. A read-only database query confirmed this independently.
  Payment was never approved. The real server/provider responses were relayed
  unchanged in Playwright to retain evidence across cross-origin navigation;
  neither PayPal nor the application payment API was mocked in this acceptance.
- Rapid consecutive runs reached the existing five-minute checkout throttle.
  The test reused its already-created order after expiry; no cap/counter reset,
  duplicate purchase or security exception was introduced.

Artifacts: `frontend/test-results-release-order-recovery-local-secure-final`,
`frontend/test-results-release-order-recovery-live`, and
`frontend/test-results-release-order-recovery-preview` (generated, untracked).
Real-provider artifacts: `frontend/test-results-release-real-recovery-local` and
`frontend/test-results-release-real-recovery-preview`.

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
