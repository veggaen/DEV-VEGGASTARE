# PayPal checkout setup and acceptance

Status: code and mocked safety tests exist; real Sandbox and Live transactions
are **not yet verified**. Do not describe payments as production-ready until
the checks below pass. Credentials were absent at the last configuration check.

## Credentials and environments

Create separate REST apps in the owner's PayPal Developer dashboard:

| PayPal app | Destination | Credentials |
| --- | --- | --- |
| Veggat Sandbox | Local `http://localhost:3000` and a dedicated Vercel Preview | Sandbox only |
| Veggat Production | Vercel project `dev-veggastare`, Production only | Live only |

Each destination needs `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and
`PAYPAL_WEBHOOK_ID`. Keep the secret server-side: no `NEXT_PUBLIC_` prefix,
commits, screenshots, chat messages, logs or browser storage. Do not copy Live
credentials into localhost or Preview. Redeploy after changing Vercel variables.

`paypalEnvironment()` allows Live only when `VERCEL=1` and
`VERCEL_ENV=production`; a local production build still selects Sandbox.
The showcase path does not use the legacy `PAYPAL_API_URL` override.

In each REST app's webhook settings, register the matching environment's
HTTPS callback and subscribe to **PAYMENT.CAPTURE.COMPLETED**:

- Production: `https://www.veggat.com/api/webhooks/paypal`.
- Sandbox: the dedicated Preview's `/api/webhooks/paypal` URL, reachable by
  PayPal without a preview password. Do not point Sandbox events at Production.
- Copy that subscription's ID into `PAYPAL_WEBHOOK_ID`; it is not the REST app
  ID or client ID. Localhost requires a separately approved HTTPS forwarding
  arrangement for webhook delivery; server capture can be tested locally first.

The current browser flow follows PayPal-hosted approval after a server-created
Orders v2 order. A JS v6 button is a separate frontend integration, not required
to replace the verified server create/capture path. If added, follow the
[SDK v6 configuration guide](https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration)
and keep the client secret on the server.

## Sandbox first

Use a Sandbox buyer, not a real card. Verify both reviewer SKUs separately and
then together: Interview Pack 29 NOK; 100 AI credits 39 NOK. Prices come from
`frontend/lib/showcase-catalog.ts`, never client-supplied totals.

1. Sign in with an isolated non-demo test account. Create a checkout, cancel
   at PayPal, and verify no goods or credits were granted.
2. Approve a new order and capture it through the server. Check amount,
   currency, merchant, order binding, capture ID and the buyer receipt.
3. Download the private JPG and TXT as the buyer; logged-out and unrelated
   accounts must be denied. Expired download links must be rejected.
4. Verify credits increased exactly once. Repeat the return/capture and resend
   the actual app webhook: no duplicate entitlement or balance increase.
5. Tampered totals, unsigned events and a return URL alone must not fulfill.
   Confirm the daily attempt cap remains enforced; do not reset it to loop tests.
6. Send one bounded credit-funded AI message, then prove zero-balance rejection
   without a provider call. Do not replenish credits merely to hide a failure.

The listener uses PayPal postback signature verification and preserves the
original event JSON. PayPal's simulator mock events do **not** support postback
verification; use events from an actual Sandbox app transaction. See
[PayPal webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/).

## Live acceptance and refunds

After Sandbox passes, configure the separate Live app in Vercel Production.
The owner completes the authorized micro-purchases with their own buyer/card;
verify each receipt, download and credit grant as above. The free isolated demo
remains available, so reviewers never have to pay. Record only non-sensitive
evidence, not credentials or payment details.

For a refund, the owner locates the exact capture in PayPal's business Activity,
confirms the buyer and NOK amount, and uses the transaction's refund control.
Record its refund ID privately. **Current blocker:** automatic refund/reversal
reconciliation of digital entitlement and remaining credits is unfinished.
Do not silently preserve/regrant refunded credits or mark the integration fully
complete from a dashboard refund alone. Implement and verify idempotent
reconciliation before opening paid checkout broadly.

Creating an order uses an idempotency key; fulfillment is separately guarded by
the verified capture ID. Provider idempotency does not replace database guards.
Reference: [PayPal request idempotency](https://developer.paypal.com/api/rest/reference/idempotency/).
