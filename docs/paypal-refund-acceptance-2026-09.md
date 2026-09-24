# Custom-credit Sandbox acceptance — 24 September 2026

This is isolated Preview acceptance, not a Live payment or a production-money
release. Existing owner Sandbox credentials and buyer were reused. No caps,
balances, download grants or payment states were edited manually.

## Verified capture and delivery

- Preview order: `cmuesp8o3000004l6hdegix7p`.
- PayPal order: `81D93463SR057314N`; capture: `7S751763CG9867312`.
- Separate lines: 122 credits / 47.16 NOK and JPG+TXT / 29 NOK. PayPal displayed
  both correctly and captured exactly 76.16 NOK, using Sandbox balance only.
- The retained isolated buyer drove the app in Playwright; real Chrome approved
  PayPal. The authenticated Playwright session completed the return and displayed
  the receipt. This is not a same-browser sign-in/return acceptance claim.
- Exactly one +122 SANDBOX purchase entry exists. Return replay did not duplicate it.
- Both receipt download buttons delivered actual files; sizes and SHA-256 match
  the private originals. Anonymous requests to the signed routes both returned 401.
- Capture webhook `WH-7MF980416C8363520-83L541216E3897414` reached the exact
  isolated Preview listener with HTTP 200 / DELIVERED, after one soft failure.
  One redelivery was requested; a successful request alone is not delivery proof.

## Refund regression discovered by the real test

PayPal completed Sandbox refund `5AS79471B6037860L` for the full 76.16 NOK.
Its real event `WH-8D973875B39688244-3M37678039075681G` received HTTP 503 from
the previous Preview handler. The app retained the purchase pending reconciliation.

Authenticated PayPal refund responses use `https://api.sandbox.paypal.com` in
their capture-reference link, while the validator allowed only `api-m`. The new
regression failed on both official non-`-m` hosts before the correction.

The fix permits exact HTTPS `api` and `api-m` origins for the matching PayPal
environment only. It still rejects cross-environment hosts, credentials, custom
ports, query strings, fragments and non-capture paths. The supplied URL is never
fetched: only its capture ID is extracted, and the server constructs its request
against its fixed API endpoint. Invoice, merchant, capture/order IDs and currency/
amount checks remain unchanged.

Touched lint and 63 focused proof/webhook/capture tests pass. The local strict
webpack build passes. Its first run encountered obsolete generated Next types;
an ignored audit tsconfig excludes those old build folders without disabling
type checking or editing the developer's accumulated tsconfig.

The existing AI refund-layout fixture could not run: its retained demo account
has no populated conversation. This prerequisite failure is not counted as a pass.
The correction is deployed as `3a4394c` / `dpl_HAXDwXbhUriwo5vgvd4RzwTH9Riv`
at the stable isolated Preview alias. Production `bfe4fd3` remains unchanged.

## Verified refund reconciliation

- Real refund redelivery passed signature verification and returned HTTP 200.
  PayPal's dashboard now shows **Success**, replacing the original Failure.
- Exactly one -122 `PAYMENT_REVERSAL` entry accompanies the original +122 grant;
  the isolated buyer's available balance is zero. No manual adjustments were used.
- The authenticated receipt shows “Your order was refunded”, zero test credits
  and no download section, without page overflow at 390 and 1280 pixels.
- Both formerly working signed download links now return 403 / revoked, even
  with the paid buyer's authenticated session. Previously downloaded copies
  cannot be recalled from the buyer's device.
- A late capture replay was DELIVERED with HTTP 200 at 02:58:04 local time.
  It did not revive the refunded order, regrant credits or restore downloads.
- A further refund replay was requested and the ledger remains unchanged;
  its individual delivery history is checked separately from the request result.
- An actual funded-model request at zero balance returns 402
  `AI_CREDITS_REQUIRED` with a buy-credits destination, not a provider call.

## Return review hardening

The older return-review endpoint could mark a request REFUNDED without sending
or verifying money, and permitted any one seller to process an entire order.
The follow-up denies manual REFUND, requires ownership/management of every line,
uses same-origin and durable throttling guards, and compares prior review state
before changes. Review approval no longer mutates stock or payment amounts.
13 focused tests pass, including mixed-seller privacy, admin refund bypass,
stale decisions and defect requests after 14 days. Strict local build and touched
lint pass; the amended terms render cleanly at 390 and 1280. Legal copy distinguishes
files from services and removes the discontinued ODR link. Checkout consent and
durable confirmation are still a separate unfinished compliance slice.

## Provider references

- [Refund captured payment](https://developer.paypal.com/api/payments/v2/captures-refund)
- [Resend event notification](https://developer.paypal.com/api/webhooks/v1/webhooks-events-resend)

Preview rollback before this correction: `71c794d` /
`dpl_AHUJ9KSH4zD6BvQotgd9jzcWfvJ5`.
