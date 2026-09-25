# Company administration — September 2026

## Findings

- `frontend/app/(protected)/admin/companies/page.tsx:308` and `:314` sent
  View/Edit to absent pages. The owner account-details page linked to the same
  missing company detail destination. Delete only displayed a coming-soon toast.
- The old list fetched each keystroke, with no stale-response protection,
  private-cache headers or bounded/validated page and sort values. Controls
  lacked labels and mobile rows hid their useful counts.
- The old PATCH accepted scalar logo/banner URLs despite array database fields,
  arbitrary registration fields and independent update/audit commits. DELETE
  attempted irreversible cascading deletion through business records.

## Repair

Working detail and edit routes retain the existing shell, tokens and role
boundary. The responsive list has labelled 44px controls, debounced URL-backed
search, stable sort/pagination, explicit empty/error states, stale-response
rejection and last-result refresh recovery. Access loss removes private rows.
Detail reads omit payout information, verification tokens and staff personal
data. The editor shows a concise company record and activity beside the form
on desktop, stacked on phones. Branding and record metadata use disclosures.
Internal link navigation and full-page departure warn about unsaved edits.

ADMIN/OWNER reads and edits require current role and session version; demo and
account-preview identities are denied. Requests are rate-limited and responses
are private/no-store. Strict bounded JSON accepts storefront fields only, with
HTTPS credential-free URLs and correctly typed image arrays. Ownership,
registration and payout changes are rejected. Same-origin writes require a
reason and the reviewed updatedAt version. A locked transaction commits the
change and exact before/after audit together. No-op, stale or replayed edits do
not write. Failed/uncertain saves keep the draft and require reloading the saved
record before retrying. Direct company deletion now returns an explicit
retention-review refusal; no fake Delete action is shown.

The design-guidelines skill informed labels, focus, touch targets, token use,
progressive disclosure and overflow checks; see the
[Vercel interface guidelines](https://github.com/vercel-labs/web-interface-guidelines).
The webapp-testing skill uses the existing TypeScript Playwright runner because
the Python helper is unavailable in this environment.

## Verification

- 45 focused policy/service tests pass, including restricted identities,
  malformed/duplicate filters, URL/array/body bounds, same-origin writes,
  current actor verification, rate limits, detail projection, exact audits,
  conflict/no-op behavior and safe error output.
- Four isolated PostgreSQL checks pass: typed field/audit atomicity, rollback
  when audit insertion fails, simultaneous edits (one success, one conflict),
  and revocation while waiting for the actor lock. The disposable schema is
  dropped afterwards, not a production/customer schema.
- Strict local webpack build and full TypeScript pass. Touched lint passes.
- An additional combined company/account/audit regression run passes **130/130**.
- Actual local Auth.js/API/browser acceptance passes directory → details →
  edit → save using one disposable company and owner in the isolated Preview
  database. Direct database inspection confirms exactly one EDIT audit with
  matching old/new fields. Stale edits, ownership replacement and deletion
  are refused; demoting that disposable owner denies further reads. Actual
  UI at 390/1280 has no horizontal overflow. Only those two fixture records
  and their scoped audits are removed afterwards.
- Initial browser-fixture runs failed due to test setup/locators: pre-hydration
  session refresh, hard navigation losing the browser-only role, measuring a
  collapsed control and an unscoped alert matching Next's route announcer.
  These runs are not counted as passes. The real local edit acceptance above
  did not simulate the company endpoint.

- Final local browser checks pass light **2/2** and dark **2/2**, without
  configured retries or skips. Eight viewport sizes (360, 390, 844x390, 768,
  1024, 1280, 1920 and 2560) exercise list and edit layouts. URL sorting,
  pagination/back, rapid search, stale responses, last-result refresh recovery,
  conflict handling, successful save, failed-save draft preservation, discard
  confirmation, footer wheel scrolling and access-loss clearing pass. A further
  light **2/2** run verifies that a focused reason field stays above the sticky
  save control at a shortened 390x480 viewport. This does not prove physical
  phone-keyboard behavior. Phone and desktop screenshots were visually reviewed.

## Deployment and hosted acceptance

Runtime `ed81eb2` builds successfully in both environments, with all 54 existing
migrations applied and none added. Both health checks pass. Staged-change
gitleaks finds no leaks; this does not clear historical repository content.

- Preview `dpl_FwCQWzxy4h3Qwh6AXg6eXPpRmsNM`:
  `https://dev-veggastare-rh49tmrvw-v3ggas-projects.vercel.app`, assigned to
  the existing showcase-ai-revival Preview alias.
- Promoted production `dpl_CrRSMTTVxb1cRW5XYSAaE1KypDFA`:
  `https://dev-veggastare-60rjc8f24-v3ggas-projects.vercel.app`.
  The production alias inspection confirms this deployment on www.veggat.com.
- Previous production rollback candidate:
  `dpl_Br5VH55HrqRSyHHqkVfYF2uxbSbW` (`69b21de`).

Preview and Live each pass light **2/2** and dark **2/2**, without retries or
skips. Privileged hosted edit scenarios use browser-only fixtures; real
anonymous/demo access-denial requests still reach the hosted API. Actual writes
are covered by the isolated local acceptance above, not customer records.

Real Chrome used the owner's existing signed-in session to search for Veggat
Studio, open its details and editor, and check Branding/Record details
disclosures. The 390px layout and footer scrolling and 1280px desktop layout
and independent sidebar scrolling were checked. No captured console errors
were returned. No form fields were changed or saved. These normal detail reads
append VIEW audit records. The temporary viewport override was reset and the
read-only company details page retained for the user.

## Limits

This slice does not implement ownership transfer, registration proof changes,
payout changes or retention-safe company erasure. It does not audit every
business membership or operational endpoint. Remote browser write scenarios
must use fixtures; no production company changes are authorized for QA here.
No payment, email, provider generation or billing change is needed.

Follow-up: the Activity "Sales" count uses `Company._count.Sale`, a legacy
sales-record table. The marketplace seller route instead reads `Order` and
`OrderItem` with payment/checkout state. Veggat Studio currently displays zero
legacy sales despite the previously verified marketplace purchases. This is
not evidence that those payments disappeared. Reconcile the metric's source
and label, with explicit paid/unpaid, Sandbox/Live and refund treatment, before
calling company sales reporting complete. No financial records were rewritten
to make the display agree.
