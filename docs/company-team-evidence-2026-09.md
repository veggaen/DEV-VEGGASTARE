# Company-team security and interaction acceptance

Scope: company team add/remove, permission edits, role edits and their real
Server Action/HTTP entry points. This is not a claim that every S8 route or
every app authorization boundary is complete.

## Reproduced failure

The original permission Server Action trusted a browser-supplied actor ID,
updated an employee without binding them to the authorized company, and returned
full user records in a raw company object. A regression test reproduced the
unauthenticated lookup/write path using mocks, not live records.

Other findings: owner without an employee row could not add staff; delegated
role editors could assign OWNER or a role at their own tier; permissions were
overwritten wholesale; client selection could remain on a different person
after typing; a role-only editor could not reach the role dialog.

## Changes

- Both Server Actions and all four HTTP mutation routes share authenticated,
  same-origin, rate-limited, demo-denied request checks.
- Current platform role, actual company owner and delegated permissions are
  read within a transaction. User share locks and company update locks serialize
  access changes. Client-supplied actor/company records are never trusted.
- Targets belong to that company; owner/self changes and fake ownership roles
  are denied. Delegated editors can manage only lower roles and permissions
  they themselves hold. Finance and staff are peers.
- Exact reviewed employee ID/version required for edits/removal. Concurrent
  stale edits fail with 409; an old removal cannot remove a re-added employee.
- Permission patches preserve unrepresented fields. Unknown/non-boolean flags
  are rejected. Responses contain only the normalized employee and public
  identity summary, never authentication fields or a raw company/user record.
- Search is bounded and debounced; keyboard selection uses displayed results;
  typing clears the previous selection. Forms have loading/errors, duplicate
  submission locks and explicit cancellation/removal review.
- Dialogs use existing theme tokens, 44px controls and a pinned action area.
  Reduced-motion overrides are scoped to these dialogs. Refresh is required
  after uncertain/stale responses. No real member or payout details changed.

The interface-guidelines review informed keyboard controls, inline status,
touch targets, token styling, and modal scroll containment. No new design system.

## Verification

- 36 focused entry-point/private-read tests pass.
- 12 real PostgreSQL tests pass in a unique `qa_company_team_*` schema on the
  isolated Preview endpoint; schema removed and absence checked afterward.
- Real database coverage: owner without membership; fresh/demoted admin;
  outsider/demo/deleted user; company binding; owner/self protection; delegation;
  unknown flags/preservation; simultaneous edits/adds; stale removal; revocation.
- Strict local production build passes. Touched-file lint: no errors; the older
  Nexus company client retains a pre-existing effect-dependency warning.
- Initial browser pass exposed transient modal positioning and a retry-test
  synchronization race. Assertions now include complete dialog bounds and
  reduced-motion animation/opacity, not only width and button visibility.
- Final six-test acceptance: local **6/6, 17.0s**; Preview **6/6, 20.7s**;
  Live **6/6, 21.0s**, zero retries or skips. The independent dark-theme pass is
  local **1/1, 6.2s**, Live **1/1, 6.9s**.
- First Live run was 5/6: the test filled the search while Radix was still
  restoring focus after cancellation. It now asserts dialog/overlay detachment
  and focus on the original Remove trigger, then clicks and types in search.
  This is a test synchronization change, not a production behavior bypass.
- Reports: `frontend/test-results-release-company-team-{local,preview,live}-focus/results.json`
  and `frontend/test-results-release-company-team-live-dark/results.json`.
- Runtime **73fbabe**: Preview `dpl_G9ebUjpJEDDQKqQYx5R6M9QKVseY`,
  immutable `https://dev-veggastare-jxp0wrcbt-v3ggas-projects.vercel.app`;
  production `dpl_GzBe9UhaKx73rXiVEFYBTGqMTPkp`, immutable
  `https://dev-veggastare-neba2uusz-v3ggas-projects.vercel.app`.
  Both are READY with passing health checks. Preview's stable alias was updated;
  production was promoted and `www.veggat.com` resolved to that deployment.
- Real Chrome on the promoted release: retained owner can open Team (0), search
  completes, and role choices exclude OWNER. No selection or write submitted.
  Desktop 1280x800, phone 390x844, page/footer scrolling and landscape 844x390
  drawer scrolling visually checked. Viewport restored; no captured console errors.

Real Chrome local account is a non-member of the permanent company: access
denied with public-profile navigation, as expected, rechecked this release.
Authoritative positive
mutations are tested only in the disposable database. Browser owner/manager
mutation interactions use intercepted responses, not real team changes.

## Remaining boundaries

This does not transfer company ownership, create legal employment contracts,
or remove members with linked payroll/work records. Those removals fail safely
and require owner review. Public user-search's broader privacy/role handling,
legacy company management pages and other S8 features still need their own audit.
