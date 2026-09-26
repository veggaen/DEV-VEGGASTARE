# Company/product lifecycle acceptance — 26 September 2026

## Scope and findings

The expanded business-workflow audit found and corrected:

- Original authors could change company listings after leaving the company.
- Edit, visibility and archive permissions were treated as interchangeable.
- Permission checks and writes were separated, allowing revocation races.
- Archiving disabled existing downloads despite the confirmation promising to preserve them.
- Public product detail/catalog specifications exposed internal repository configuration.
- Ordinary edits could overwrite repository settings; a failed settings read could disable them.
- “Save & View” depended on stale React state.
- Company setup contained block elements inside a paragraph, causing React hydration error 418 and lost early input.

Lifecycle changes now use fresh session/role data and a User → Company → Product
lock order. Company membership revocation shares the company lock. Each operation
has its own capability, reflected in the management controls. Private integration
settings stay outside public facts and require the seller owner (or current platform
administrator); these checks do not certify external GitHub grant/fulfillment safety.

No payment, credit, price-list, database-schema or customer-data changes.

## Evidence

- Five original authorization regressions failed before the fix.
- 108 focused unit tests pass across product lifecycle, publishing, reads, catalogue/purchase state and specification boundaries.
- Six isolated PostgreSQL tests pass. They join company creation, adding an employee,
  permission grants, physical/digital publication, inventory association, lifecycle
  operations and author revocation. They also cover personal ownership, foreign
  assets/wallets and transaction rollback. Tables/enums are cloned without customer
  rows into an exact random QA schema; cleanup confirms the schema is gone. Foreign
  keys are not cloned by PostgreSQL LIKE; the browser tests below use actual Preview tables.
- Four actual-server browser workflows pass locally at 360, 390, 1280 and 2560px.
  Each creates two disposable password users in the isolated Preview database, creates
  the company through the form, adds/updates/removes its employee through the real HTTP
  endpoints, seeds physical/digital catalogue rows, and edits those rows through the UI.
  Save and Save & View, hide/publish, archive cancel/confirm, retained downloadsEnabled,
  fresh-login persistence, private-spec preservation and an old-tab save after revocation
  are verified against committed database data. No browser page errors or horizontal
  document overflow in the scoped listing check. Fixture rows are cleaned up.
- Strict production build/TypeScript and lint on touched files pass.
- Real Chrome confirms company-form typing, retained unsaved values, page scrolling,
  and access to the bottom submit action. The QA draft was cleared, not submitted.
- Testing/web-interface skills shaped the actual workflow checks, early-input guard,
  error-state assertions and viewport verification; screenshots are not treated as
  proof of successful business operations.

## Reproduce

Run only with the guarded isolated-Preview launcher; never supply a Live database:

```text
npx vitest run actions/products-lifecycle.test.ts actions/products-publishing.test.ts lib/product-publishing.test.ts lib/product-read.test.ts lib/product-specifications.test.ts
TEST_PRODUCT_PUBLISH_DATABASE=1 [isolated launcher] vitest run lib/product-publishing.database.test.ts
E2E_BUSINESS_DB=isolated-preview [isolated launcher] playwright test --config playwright.route-audit.config.ts --grep "isolated company/product"
```

The browser test allows only localhost:3000 or the exact isolated Sandbox Preview
origin. Product rows are seeded for the UI lifecycle test: **this is not evidence of
browser uploads, complete product-wizard publication, paid digital downloads or physical
fulfillment**. Those scenarios, the team dialog's complete joined UI flow, advanced
permission flags, stock editing consistency, full responsive design acceptance, jobs,
paper trading, P2P and local-chain settlement remain PARTIAL in the acceptance contract.

## Hosted verification

Runtime `305d48b` was cherry-picked into integrated Preview as `57d96bc` and deployed
as `dpl_3HaG2EGW2ER3bAfYbnpeRezyeMgJ`. All four real-account workflows pass there
at 360/390/1280/2560 (2.4 minutes). Two additional read-only public-access/browser
checks pass locally and on Preview (390/2560): no private specs, no anonymous
integration access/writes, no management controls or horizontal document overflow.
The disposable company/user records are removed; real Chrome's refreshed company
directory shows only the permanent studio. Release secret scan passes.

Production promotion pending. The integrated Preview's extra payment/schema work
is not part of the safe release worktree or its 56-migration production deployment.
