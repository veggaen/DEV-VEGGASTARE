# 9 NOK Sandbox starter acceptance

25 September 2026 (Europe/Oslo). This is test money, not a Live purchase.

## Real browser path

Owner's real Chrome, isolated Preview: credit product -> select ten-credit
starter -> apply amount -> Buy now -> unchecked delivery request reviewed and
selected for this test -> Continue to PayPal -> existing Sandbox buyer login ->
PayPal balance, 9.00 NOK -> complete -> Veggat receipt.

The receipt shows ten test credits and the correct Sandbox label. Global USD
(ETH) display preferences remain applied; the original PayPal amount is 9 NOK.
The buyer password was read from the owner's signed-in Sandbox dashboard and
entered only into `sandbox.paypal.com`; it was not printed, committed or saved.

## Verified records

- Preview deployment: `dpl_HYATp3FnCWFuqgBMwVskvC2HoWYL`.
- Veggat order: `cmug34e4m000004jqjrcuwgfm`.
- PayPal order: `74A75891KW3531110`.
- Capture / receipt: `2VM34999NP201105J`.
- PayPal authenticated capture GET: `COMPLETED`, `9.00 NOK`, matching invoice.
- Isolated database, read-only check: attempt and payment completed; exactly
  one `PURCHASE` ledger entry, delta +10; Sandbox balance 10, refund adjustment 0.
- Webhook event: `WH-7D579587NC938521V-9UM20458U50428509`.
- Vercel request logs: initial webhook HTTP 200 at 00:11:01 and exact event replay
  HTTP 200 at 00:13:52. The replay targeted only the existing Preview webhook.
- Receipt reload and authenticated webhook replay leave one +10 grant and
  balance 10. No double fulfillment.

The current showcase webhook handler does not write the legacy
`PaymentWebhookEvent` table; its absence is not treated as a delivery failure.
Evidence above uses PayPal's event API, Vercel request status, and ledger state.
The replay follows [PayPal's event replay API](https://developer.paypal.com/api/webhooks/v1/webhooks-events-resend).

## Payment-to-AI acceptance

The same real Chrome session opened chat with ten credits. Selecting GPT-6 Astra
(60 credits) displayed insufficient funds and kept Send disabled even with a
draft. Switching to GPT-5.6 Luna (two credits) preserved the draft, streamed the
requested short answer, and reduced the balance from ten to eight.

A read-only ledger check confirms exactly one completed OpenAI generation,
two credits reserved/debited and a 15,000 micro-USD conservative provider budget
reservation. No Astra reservation exists. The model ID was checked against the
[official OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna).
The app uses bounded direct-provider requests; no SDK/dependency migration was
needed for this test.

The retained exhausted Live demo session was also reused: the dedicated
Playwright test passed the zero-credit disabled composer and independent server
HTTP 402 checks at 360, 390, landscape, 1280 and 2560 widths. No new demo grant or
provider call was made in that recheck. Artifact:
`frontend/test-results-release-zero-credit-live-recheck/`.

The original digital product was restored to the Sandbox cart after the
starter-only purchase. No Live cart item or owner payment approval was changed.

## Still not claimed

No Live payment, fresh refund, fresh digital-file purchase or email delivery
is established by this starter-credit test. The separate 9 NOK Live checkout is
retained for the owner to review and approve. All Live acceptance remains open
until verified server capture and entitlement checks, not a return URL or an
ambiguous chat message.
