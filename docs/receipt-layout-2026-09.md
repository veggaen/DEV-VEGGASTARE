# Compact receipt and first Live starter purchase

25 September 2026 (Europe/Oslo).

## Live payment evidence

The owner retried the existing 9 NOK order with a different PayPal buyer account.
The merchant-account rejection was not a successful payment; the later approval was.

- Order: `cmug44q96000004l8zgx0cxo9`.
- PayPal order: `3XL1972193645690B`.
- Server-recorded verified capture: `8N819301P61947841`, completed
  `2026-09-24T22:48:03.675Z`, 900 ore / NOK.
- Read-only production checks: attempt and payment `COMPLETED`; exactly one
  `PURCHASE` entry of +10; Live balance 10, refund adjustment 0.
- Production request logs: `/api/webhooks/paypal` returned 200 at 00:48:07.71.
- No new order, refund, balance adjustment or Live key transfer was performed by
  the verification checks. Live digital-product purchase and Live refund remain open.

PostgreSQL timestamp-without-time-zone columns store UTC. Ad-hoc read-only checks
must use `AT TIME ZONE 'UTC'`, not the pg driver's local-time interpretation.

## Receipt design

- Bounded 1152px canvas; two columns from lg, one column below lg.
- Purchase/AI action or private downloads first; amount, balance, capture ID and
  downloadable original confirmation in a compact payment panel.
- Price explanation, original terms/email details and help/refund form use native,
  keyboard-accessible disclosures. Existing support requests open automatically.
- Mobile product title and price stack rather than squeezing the title beside a
  fiat/crypto amount. Global selected-currency formatting stays unchanged.
- Payment-verification screen follows the same canvas and skeleton layout. Its
  escape link leads to the existing order, not a new cart checkout.
- Capture, consent records, signed downloads, credit grants and refund policy are
  unchanged. Original confirmation files retain their existing contents.

The [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
informed focus visibility, semantic disclosures, content reflow and reduced-motion skeletons.

## Acceptance

19 receipt/confirmation/acknowledgment units, touched-file lint and strict
production-style local build pass. Two focused local Playwright checks pass:

1. Retained demo receipt at 360, 390, landscape 844, 768 portrait, 1024, 1280x800,
   1920 and 2560, dark/light. No horizontal overflow; desktop navigation and
   confirmation download are in the initial viewport. Keyboard support disclosure,
   problem form open/cancel and original confirmation download work. No payment write.
2. Mocked verification outage/retry preserves the same order ID and links to it;
   no real capture is made by UI QA.

Real Chrome local checks use the actual 9 NOK Sandbox receipt, not a mocked
purchase. Primary content fits the desktop viewport; mobile stacking is inspected.
Local artifacts: `frontend/test-results-release-receipt-compact-local-final/`.

Production deployment `dpl_Gufib3EFRKsz74egBM3PGm2CKhsM` was promoted to www.veggat.com.
Both focused Playwright checks passed live. The retained live demo has an existing
support request, so the test verifies its intentional default expansion and then
collapses it for geometry checks. Real Chrome also shows the owner's verified
9 NOK receipt, capture ID and 10-credit balance in the new layout.
Live artifacts: `frontend/test-results-release-receipt-compact-live-final/`.

The separate unpaid-order recovery
implementation is preserved in the named Git stash `wip: unpaid order recovery
awaiting integration tests`; it is not included in this receipt-only release.
