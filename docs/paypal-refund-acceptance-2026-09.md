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
Preview redeployment, real refund redelivery, credit revocation and paid-download
revocation are pending. Production `bfe4fd3` remains unchanged by this fix.

## Provider references

- [Refund captured payment](https://developer.paypal.com/api/payments/v2/captures-refund)
- [Resend event notification](https://developer.paypal.com/api/webhooks/v1/webhooks-events-resend)

Preview rollback before this correction: `71c794d` /
`dpl_AHUJ9KSH4zD6BvQotgd9jzcWfvJ5`.
