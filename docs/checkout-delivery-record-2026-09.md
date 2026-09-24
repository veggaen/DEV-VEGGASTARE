# Explicit delivery requests and retained confirmation — 24 September 2026

## Implemented

- New paid reviewer checkouts require separate, initially unchecked requests for
  digital-file delivery and AI service start, according to the server's cart.
  Keyboard submission focuses the missing request, without creating an order.
- The server validates the policy version and booleans, then saves its own exact
  wording, purchase-record text and timestamp with the immutable quoted order.
  Client timestamps, substituted terms and extra consent fields are rejected.
  Idempotent retries retain the original snapshot. Historical orders are not
  assigned retrospective consent; free demo orders never claim paid acceptance.
- After verified fulfillment, the buyer can download an authenticated `.txt`
  original confirmation with seller/contact details, item prices, actual NOK
  total, capture reference, delivery requests and retained purchase terms.
  This record is unchanged by later refunds or published terms changes, contains
  no private asset token, and is explicitly not a tax invoice or refund receipt.
- Reads are owner-scoped, durably throttled, private/no-store and attachment-only.
  Anonymous access is 401. No record is generated for an unpaid or legacy order
  with no recorded agreement. Neither this endpoint nor consent grants access.
- Phone credit controls now use the full item-card width rather than squeezing
  under the description beside a thumbnail. Existing tokens and layout are reused.

## Important boundaries

This is NOT an automatic no-refund rule. A saved file cannot be recalled, and a
download count is not a blanket withdrawal waiver. Defects, missing content,
mandatory rights and provider disputes remain reviewable. Verified refunds still
revoke future downloads and purchased credits regardless of prior downloads.

The confirmation is offered for the buyer to save; **transactional email delivery
and proof of delivery are not implemented here**. Do not claim the downloadable
record alone proves that the full agreement and required confirmation were
provided on a legally sufficient durable medium. The purchase-record text does
not replace review of the complete sales terms, required withdrawal form, seller
details and digital-service disclosures by Norwegian counsel. No automatic
withdrawal-right loss is enforced from these checkboxes.

Current legal research also surfaced the proposed/enacted electronic withdrawal
function in [Lovvedtak 85 (2025–2026), section II, new §20a](https://www.stortinget.no/no/Saker-og-publikasjoner/Vedtak/Beslutninger/Lovvedtak/2025-2026/vedtak-202526-085/?m=0).
It describes prominent withdrawal/confirmation actions and a durable acknowledgment.
Its commencement clause delegates effective dates to the King; the specific
commencement decision has not been verified in this slice. Audit the buyer's
withdrawal flow and email acknowledgment before asserting compliance.

The distinction between digital content and services is supported by the
[Norwegian legislative explanation](https://www.regjeringen.no/no/dokumenter/prop.-50-ls-20222023/id2966742/?ch=8)
and the indexed [current withdrawal law](https://lovdata.no/lov/2014-06-20-27/%C2%A722).
Lovdata's full page returned 405 to the browser fetch, so this is not a claim of a
complete current-law review. UI review used the
[Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md).

## Verification

- Payment/return unit suite: **156 passed**, one opt-in database test skipped in
  the ordinary run. That database test passed separately against isolated Neon,
  covering demo and Sandbox prepare with 122, 555 and maximum mixed-cart amounts;
  every synthetic user/cart/order write rolled back. No provider called.
- Strict production-mode local build and touched ESLint pass.
- Focused browser journeys cover an actual unpaid demo order and retainable
  confirmation, anonymous rejection, custom credits, payment-error retry identity,
  two explicit unchecked requests, keyboard focus and scrolling at 360, 390,
  844 landscape, 1280 and 2560. Paid checkout POST is intercepted for the UI test;
  this does not claim a new Sandbox/Live payment approval.
- Temporary additions to the isolated password buyer's cart are removed after
  the test; pre-existing rows are preserved. No owner cart, keys, caps, Live
  balance or production schema is changed.

## Release boundary

Preview-only. Before any production promotion, merge the newer production
currency-filter/basket fixes; do not overwrite them by promoting this branch
wholesale. Email/withdrawal work, production reconciliation and owner Live
micro-purchase acceptance remain separate unfinished requirements.
