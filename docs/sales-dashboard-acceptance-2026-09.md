# Personal Sales dashboard — September 2026

## Scope and findings

This replaces the legacy `/my-sales` presentation and its personal read API, not
warehouse shipment operations or seller request decisions. Review used the
[Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)
and the real signed-in Chrome page. Existing payment and credit code is unchanged.

- `frontend/app/(protected)/my-sales/page.tsx:121` (prior source): each visit
  launched one page request and five count requests. Counts now accompany the
  bounded page in one response, computed with the same authorized relation filter.
- Prior fetch errors became an empty list; the new UI distinguishes initial
  failure, malformed responses, true empty results and refresh failure. Existing
  orders survive a failed refresh with an explicit stale-data warning.
- Filters, pagination and expanded details are URL-addressable. Filters stay
  mounted during loading; only the results skeleton changes. Obsolete requests
  are aborted and cannot replace a newer selection.
- Prior icon navigation lacked a name, order disclosures lacked expanded state,
  phone rows squeezed multiple columns together, and copy mixed two languages.
  The replacement uses existing theme tokens, bounded width, labelled 44px
  controls, keyboard disclosures, wrapping references and one English UI.
- The old displayed-value metric was called revenue even for unpaid/refunded
  orders. It now explicitly means the value of displayed items, not profit,
  received funds or payouts. Verified checkout state distinguishes a refund from
  the legacy Payment row's completed state. Selected fiat/crypto presentation
  still uses the shared renderer; no payment amount is recalculated.

## Security and data boundaries

The API preserves the existing personal permission: direct product seller or
company OWNER. A global admin role is not a cross-seller override here. Rate
limits remain in place; strict query validation bounds page and limit and rejects
duplicates/unexpected keys. Responses are private/no-store. Demo identities return
an empty read-only workspace before querying customer/order tables.

Order and grouped-count queries share the same relation predicate; item selection
is separately scoped. Whole-order payment routing and tracking are withheld if
other or additional unreturned lines exist. Only physical products expose necessary
delivery-address fields; digital orders do not expose shipping addresses. Existing
email-visibility rules apply. A response returns at most 100 orders and 50 owned
lines each; the UI uses 20 orders and explicitly labels the 50-line boundary for
large historical orders. This is not a new multi-seller settlement system.

External shipment links must be HTTPS without URL credentials. Failure responses
do not include database details. This read-only slice never ships an order,
approves a claim, grants files/credits or moves funds.

## Verification

- 23 new API/transport units; total focused payment/legal batch **238 passed**,
  15 opt-in cases skipped. Touched ESLint passes.
- Four real PostgreSQL tests pass against a random disposable schema in the
  isolated Preview database. They cover own/company/mixed/foreign/empty orders,
  grouped counts, pagination, company-role revocation, personal admin scope,
  hidden email, refund status and demo privacy. All synthetic tables were dropped;
  no customer records, provider calls or grants were made.
- Initial strict typecheck found a narrowed-session closure issue; capturing the
  role before serialization fixed it. The initial build passed. A subsequent
  loading refinement keeps filter controls mounted while a newer query is pending.
- The first local browser batch had an ambiguous alert locator (the app alert and
  Next.js route announcer both matched). Scoping it to main fixed the test; the
  same checks then passed **3/3**. Real Chrome at 390px subsequently revealed
  overly bright dark-mode borders. Explicit existing border tokens and slightly
  denser mobile metric spacing fix that visual issue; no new design system.
- Final source inspection also caught completed demo orders without a Payment
  row being described as completed payments. The API now retains the checkout
  environment independently; the UI says “Demo — no payment”, or “No verified
  payment recorded” when appropriate. Unit and browser regressions cover this.
- Final strict local production build passes. Local browser checks pass **3/3**
  in light mode plus **1/1** dark-mode responsive replay after the demo fix.
  Preview/live acceptance and exact deployment references are pending for this
  final payment-label correction. The focused tests include actual demo API isolation separately
  from mocked presentation fixtures, 360–2560 widths, long text, keyboard toggle,
  footer scrolling, retry, malformed responses, rapid filter changes, history and
  selected fiat/crypto regression. No fixture proves a real seller transaction.

## Open gates

Owner Live payment/refund and human-inbox acceptance remain unverified. Real
wallet interaction, remaining OAuth consent flows, Railway deployment, native
125% zoom and full-route interactive QA remain separate requirements. This slice
does not establish whole-app production readiness.

Rollback app: `4b77afb` / `dpl_3LU97pZnwY1w4Kh9W5mMZWEqDR6d`. No migration or
new secret is needed. Roll back page and API together; their transport changed.
