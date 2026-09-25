# Account settings security and request review — 25 September 2026

Scope: personal Account/Security settings and account-owned deletion requests.
This is not acceptance of every admin mutation or the complete erasure workflow.

## Findings and changes

- The reachable settings Server Action trusted a TypeScript-only input type and
  spread caller fields into a User update. Its role branch did not prohibit an
  ADMIN from selecting OWNER. No exploit was run against a real account.
- Runtime strict validation and an explicit database allowlist now reject
  unrelated fields and self-service role changes for every role. Existing
  unchanged-role submissions remain compatible but never write the role.
- Password/security changes require the current password when one exists.
  Enabling email two-factor, changing an existing two-factor account, and
  security changes on passwordless accounts require a verified-email code.
  The HMAC-stored code is account/host/change/security-state bound, expires in
  five minutes and is consumed in the same transaction as the change. It is not
  interchangeable with a login code. No code/password/provider body is logged.
- Sensitive changes increment the existing session version and revoke unused
  recovery/login proofs. Fresh state is checked under a User row lock; no
  mutation commits if confirmation or revocation fails. The action rejects
  demo/impersonated sessions, bad origins and durable rate-limit failures.
- The old email edit issued a registration token rather than an account-bound
  replacement. That flow is **not implemented**: the field is now explicitly
  read-only and direct replacement is rejected, without a misleading email.
  A proper verified email-change flow remains required follow-up, not DONE.
- Account and Security submit separate fields. Session refresh no longer
  replaces the form with loading and clears drafts/confirmation. Inputs have
  password/code autocomplete and touch-sized controls. The settings card no
  longer stretches to the full height of the section navigation.
- The build manifest exposed `executeAccountDeletion` despite there being no
  source caller. It had no authentication and attempted cascading deletion.
  The unused execution export was removed, not exercised. No customer data was
  deleted. Queued deletion requests now authenticate, check origin/demo status,
  throttle, bound reason text, serialize per account, and cancel only PENDING
  rows. The UI reports a review request, not a verified automatic deletion.
  Retention-safe execution/admin review remains **PARTIAL**.

## Verification

- 69 focused unit checks pass (settings boundary, recovery, durable throttling,
  deletion request ownership/exports).
- Three isolated PostgreSQL checks pass: eight security confirmations produce
  one update/version increment; a deliberately failed revocation rolls back the
  mutation and code consumption; eight deletion requests produce one request,
  and a processing request cannot be cancelled. Disposable schemas were removed
  after the tests. No production tables, account settings or emails were changed.
- Touched-file lint and strict local production build pass. The rebuilt Server
  Action manifest no longer contains `executeAccountDeletion`.
- The local browser case passes in both themes without retries/skips. It covers
  Account/Privacy-field separation from Security, confirmation, invalid code,
  resending, retained password draft after errors and the requested reauthentication
  destination. It does **not** change a real credential: all writes/sign-out are
  intercepted; the real underlying session is the retained demo. Eight sizes
  (360, 390, landscape 844, 768, portrait 1024, 1280, 1920 and 2560) have no
  horizontal overflow. Actual mailbox delivery and real credential replacement
  are not claimed by these fixtures.
- Final local build, 69 units, three isolated database checks and touched lint
  pass. The post-build light run initially received a null demo session; its
  cause is unproven. The dark run and an explicit fresh light run pass, without
  configured retries. This is not reported as an uninterrupted first-pass run.
- Real Chrome at 390px confirms the save action stays visible and page scrolling
  reveals the remaining text and footer. Replacing the intermediate horizontal
  overflow scroll container with clipping restores the sticky action. The
  temporary viewport override was reset. A physical phone keyboard is not tested.

The first strict build caught a test-only Headers union mismatch. The first
browser run needed a hydration wait; the next exposed the real session-refresh
draft reset. Both were corrected. A deletion-action syntax typo and a missing
enum in the disposable test schema were corrected before release validation.
The first redirect assertion also incorrectly expected a mocked sign-out to
remove the real demo session; it now verifies the requested login destination
without claiming the fixture performed a real sign-out.

## Remaining boundaries

Human delivery of the new security email is not claimed from a mocked send.
Existing provider-login second-factor behavior is unchanged; the UI explicitly
describes the code as applying to password sign-in. Privileged user-detail
email/role/verification writes, impersonation and the admin hard-delete endpoint
still need their separate audit. Historical public-repository exposure and
GitHub billing/CI remain separate owner-action items.

References: [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html),
[Next.js Server Action security](https://nextjs.org/docs/app/guides/data-security),
[interface guidelines](https://github.com/vercel-labs/web-interface-guidelines).
