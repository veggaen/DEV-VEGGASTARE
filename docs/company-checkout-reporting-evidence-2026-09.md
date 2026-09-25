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

## First reporting deployment

Runtime `12aee0d` passed strict Preview/production builds, with 54 existing
migrations and none pending. Preview `dpl_2XcknRCHJbf7VoyGoh3o15yXcHzo`
(`dev-veggastare-dxkq2b059-v3ggas-projects.vercel.app`) was assigned to the
existing showcase Preview alias. Preview light **2/2** and dark **2/2** passed
before production `dpl_FZRs8JhpyciGWYdzs5XtYVohvPky`
(`dev-veggastare-aglpc5xv3-v3ggas-projects.vercel.app`) was promoted. Live then
passed light **2/2** and dark **2/2**, with no retries or skips. Both health
checks were healthy. Staged-change gitleaks found no leaks; historical repository
clearance is not implied.

The first Preview browser launcher invocation used the repository root instead
of frontend and never launched Playwright. It is not a passing run. The ignored
helper now sets its own working directory, and the actual runs above passed.

Real signed-in Chrome showed Veggat Studio's actual **2 Live paid orders**,
**2 Sandbox captures**, zero Live adjustments/reviews and zero legacy sales.
The disclosure opens and phone-width scrolling reaches the readable metrics
and footer. Viewing details adds normal VIEW audit records, not payment writes.
No Live fields were edited, payments initiated or emails sent.

The desktop visual review caught a tall right-only stack of read-only cards,
with needless unused space on the left. A layout follow-up flattens the saved
record/activity cards into two balanced desktop columns while retaining the
stack on smaller screens and the editor's form/sidebar arrangement. Browser
assertions now cover detail pages at all eight sizes and require the collapsed
checkout summary to fit without scrolling at 1280x800 and wider test sizes.
The follow-up strict local build and light/dark **2/2 each** browser checks pass.
Screenshot review caught that an initial test scrolled `window`, not the app's
scroll container; the final checks explicitly bring the heading into view and
assert it remains visible while the summary fits. The final 1280x800 screenshot
was visually reviewed with both heading and full collapsed summary visible.
Hosted layout acceptance and promotion are pending.

## Scope

This read-only reporting repair does not initiate payments, grants, refunds or
emails. It does not change seller tax reports or make legacy crypto status into
independently verified payment proof. Broader company financial reporting and
the full production feature scoreboard remain separate work.
