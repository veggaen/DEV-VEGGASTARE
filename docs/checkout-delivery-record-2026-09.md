# Explicit delivery requests and retained confirmation — 24 September 2026

Current release follow-up: a [guarded transactional email outbox](transactional-email-acceptance-2026-09.md)
now queues eligible new purchase/notice copies; provider acceptance is verified,
but delivery to a real person's inbox is not. Downloadable originals remain
available. [Buyer notices](buyer-request-acceptance-2026-09.md) and the
[seller-review follow-up](seller-review-acceptance-2026-09.md) have separate evidence.
The implementation and verification sections below describe the original slice.
The
Preview-only release boundary at the bottom records the original historical
delivery-record release; it is not the current deployment authority. See the
[production scoreboard](production-scoreboard.md) for that authority.

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

The original slice offered the confirmation for the buyer to save; email was
added later by the linked outbox release. **Human inbox delivery is still not
verified.** Do not claim the downloadable
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
- Real Chrome completed the existing **free demo** credit cart as order
  `cmuevx0is0006e4t54861rob5`. The receipt says completed / 0 NOK / no paid credits.
  Clicking its confirmation link produced a real browser download; the resulting
  3,950-byte TXT in Downloads was checked for the original-record heading,
  `Actually charged: 0.00 NOK`, no paid-consent claim, and no `token=` value.
  The demo cart was consumed normally; no real-owner cart or PayPal order changed.
  Real Chrome 390px scroll reached payment and footer; override reset afterward.
- Final browser runs: **2/2 local (15.0s)** and **2/2 deployed Preview (32.6s)**.
  Screenshots at 390/1280 were visually reviewed. The first visual pass caught
  cramped phone controls and a validation warning that remained after correction;
  both were fixed and the journeys rerun without weakening assertions.
- Real Chrome also completed a **free Preview file order**
  `cmuew1mus000504lc3cft9gr5` in the same browser session as demo login. Its
  3,934-byte order confirmation downloaded with the unpaid/no-paid-consent labels.
  Receipt JPG and TXT controls sent files without leaving the receipt. The
  browser tool's download-event waiter timed out for these blob-based downloads;
  no repeated clicks were issued. Fresh UI showed completion, and the actual
  Downloads artifacts verified successful transfers:
  - JPG: 539,906 bytes; SHA-256
    `1b91c27fe3993088e0ddfa453e4811bb1efbd60ec5ef68c5749bb48261c0b5ca`.
  - TXT: 2,682 bytes; SHA-256
    `47ae3c0bbc6910679789463d167845f0cdb2c17484e5779a82daac5d93e3a96a`.
  These match the private originals from prior Sandbox acceptance. Both receipts
  were left open. This is free-demo fulfillment, not a new paid PayPal purchase.

## Release boundary

Preview source **4eb2e76**, deployment **dpl_FSe3qUPRo4eBrCqXqHjtm8jG2NrM**, is READY:
`https://dev-veggastare-31eih412v-v3ggas-projects.vercel.app`.
The stable showcase Preview alias was assigned and read back to this deployment.
Vercel's strict build passed; isolated Neon had 47 migrations and none pending.
Rollback Preview: `dpl_H8eb2Kb6xAhVP578H47yp55dsFNt` /
`https://dev-veggastare-bv9burkvy-v3ggas-projects.vercel.app`.

Preview-only. Before any production promotion, merge the newer production
currency-filter/basket fixes; do not overwrite them by promoting this branch
wholesale. Email/withdrawal work, production reconciliation and owner Live
micro-purchase acceptance remain separate unfinished requirements.
