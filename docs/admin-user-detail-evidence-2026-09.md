# Account administration — September 2026

## Scoped change

The user editor now saves only changed profile fields, with a mandatory reason
and the timestamp of the account version the operator reviewed. Email, provider
proof, verification scores and ownership are not editable through this form.
ADMIN can edit ordinary members; OWNER can also edit ADMIN accounts and change
USER/ADMIN roles. Self, OWNER and demo-account edits are refused. Ownership
transfer is not implemented or implied by this ordinary editor.

The server locks actor and target in deterministic order and checks current
actor role/session version before reading or writing. Profile changes and their
minimal before/after audit record commit atomically. A role change increments
the target's token version. Audit failures roll back the update. Strict bounded
JSON, same-origin writes, separate durable read/write budgets and private/no-store
responses apply. Auth and database failures do not disclose exception details.

The former direct DELETE could cascade through related records. It now refuses
the operation without deleting or pretending to queue a request. Retention-aware
erasure remains a separate unfinished workflow, not a completed feature.

The editor uses the existing theme tokens, two balanced desktop columns and a
single-column portrait/phone layout. It preserves drafts across session refresh,
offers explicit reload/discard confirmation after conflicts, keeps Save visible,
and gives labelled 44px controls and inline errors. Images and record metadata
use disclosures. Read-only identity facts are separate from editable fields.
Decorative entrance motion and the oversized banner were removed.

Review references: [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)
and [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Verification

- 85 focused unit tests across the new detail boundary, durable throttling and
  existing preview issuance: pass. Touched ESLint passes.
- Four real PostgreSQL transaction checks in a disposable isolated Preview
  schema: pass. Role/version/audit commit, replay denial, audit-outage rollback,
  simultaneous-edit conflict and revocation while waiting for a lock are covered.
  The initial fixture lacked the UserRole enum; that fixture mismatch was fixed
  and all four rerun. The validated disposable schema is removed after each run.
- Local production build and full TypeScript check: pass before browser tests.
  Local uses the isolated Preview database and Sandbox PayPal only.
- Local Playwright light 2/2 and dark 2/2, no retries/skips: real anonymous/demo
  endpoint denial; browser-only edit fixtures for load failure/retry, required
  reason, sparse PATCH, session-refresh draft retention, conflicting-save recovery,
  role-change cancellation, navigation cancellation, invalid upload, read-only
  permissions and eight viewport sizes (360, 390, landscape 844, 768, portrait
  1024, 1280, 1920, 2560). No page errors or horizontal overflow.
- Actual local HTTP + UI acceptance uses two disposable accounts and encrypted
  test-issued sessions, not a claim of a new login-method test. A 390px UI save
  persists, stale update fails, role change invalidates the member session, and
  DELETE does not remove the account. Exact EDIT/ROLE_CHANGE audit entries and
  390/1280 layout are verified. Both QA accounts and their audit rows are removed;
  no customer, payment, provider generation or email is affected.
- A final small UI adjustment keeps the phone Discard/Save actions on one row;
  final build and post-deploy reruns are pending below.

Artifacts (ignored): `frontend/test-results-release-admin-detail-*` and
`frontend/test-results-release-admin-detail-http`.

## Deployment / remaining acceptance

Preview and Live deployment verification pending. Real Chrome reached the
retained admin access gate on both localhost and Live; owner sign-in was requested
in the retained Live tab. No gate, role or authentication protection was weakened.
Real-Chrome privileged acceptance, actual hosted image-upload acceptance,
ownership transfer, verified email replacement, security-change step-up for role
management and retention-safe erasure remain separate follow-ups. This scoped
slice does not certify all admin routes or the full app.
