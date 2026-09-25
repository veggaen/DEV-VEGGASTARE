# Company checkout reporting — September 2026

## Finding

The company directory and detail page labelled `Company._count.Sale` as
"Sales". This legacy operational table does not receive the verified checkout
records used by Veggat's marketplace. Veggat Studio consequently displayed zero
despite its verified PayPal purchases. No missing payment was inferred from
that legacy count.

## Change

Company administration now shows **Live paid orders** from server-owned
`CheckoutAttempt` proof joined to `Order` and the company's current products.
Each order counts once per company, regardless of quantities or multiple line
items. Reporting loads one bounded aggregate per page, not buyers or every order
into application memory. Reads retain the current admin/session boundary and
private/no-store responses, in the same repeatable-read snapshot as the company
data. A reporting failure returns an error, not a fabricated zero.

The detail page separately shows Live refunds/reversals, Live payment reviews
and Sandbox captures. Merchant/order/capture identifiers, a positive NOK amount,
matching buyer, valid adjustment range and consistent recorded state are
required. Demo/unpaid orders, legacy status-only orders and incomplete proof
are excluded. Paid orders need the completion timestamp; verified adjustments
can precede local fulfillment and use their adjustment timestamp instead.

The old count remains explicitly labelled "Legacy sales records" inside the
counting disclosure. The display follows **currently linked products**, not an
immutable seller-at-sale ledger. It is not revenue, tax reporting or historical
seller attribution; no accounting or payment records are rewritten. A shared
order can count once for each company whose product it contains.

The web-design-guidelines skill informed labelled numeric groups, tabular
numbers, existing token surfaces and a keyboard/touch disclosure instead of
always-visible explanatory text. See the
[interface guidelines](https://github.com/vercel-labs/web-interface-guidelines).
The webapp-testing skill uses the repository's existing TypeScript Playwright
runner; its Python helper is unavailable in this environment.

## Verification

- 47 focused company service/policy tests pass; the combined company,
  account-detail and audit-log regression passes **132/132**.
- Nine isolated PostgreSQL checks cover existing edit atomicity plus distinct
  order counts, company isolation, proof exclusion, Live/Sandbox separation,
  adjustments before fulfillment, parameterized scopes and unchanged payment
  records. The disposable schema is removed after the run.
- The first actual-HTTP fixture run failed because its synthetic completed
  checkout lacked merchant/provider-order identifiers. The database correctly
  rejected it; exact disposable records were removed. The fixture was corrected
  without weakening the database constraint. That failed run is not a pass.

- Strict local webpack production build and full TypeScript pass. Touched
  ESLint passes (the pre-existing large suite triggers a Babel size notice).
- Actual local Auth.js/API/UI acceptance passes with an isolated disposable
  owner, company, two hidden products and two synthetic completed orders.
  Both orders contain two lines; the API and UI correctly show one Live and
  one Sandbox order. These are synthetic reporting fixtures, not claims of a
  new provider payment. Existing edit/audit/conflict/access-loss checks pass;
  exact fixture records and scoped audits are removed afterwards.
- Local browser acceptance passes light **2/2**, dark **2/2**, with no skips or
  retries. The count labels, values and definition disclosure are checked;
  the existing eight viewport, list recovery, edit recovery and access-loss
  scenarios also pass. Actual 390/1280 UI checks pass and screenshots were
  reviewed. This is not a new physical-phone or 125% zoom acceptance claim.

Hosted acceptance and deployment evidence pending.

## Scope

This read-only reporting repair does not initiate payments, grants, refunds or
emails. It does not change seller tax reports or make legacy crypto status into
independently verified payment proof. Broader company financial reporting and
the full production feature scoreboard remain separate work.
