# Request-board access revocation

## Reproduced issue

The experimental `/jobs` board includes public requests and requests shared with
a user's companies. Its account-scoped SWR key prevented cross-account reuse,
but a rejected refresh retained previously loaded rows even after HTTP 401/403.
The existing transient-error test did not cover revoked access.

A new browser regression loads a synthetic company request, returns 401 on
Refresh, and expects its link to disappear. On the preceding production-style
local build it failed: one private-request link remained instead of zero.
An earlier run could not connect because the local server had stopped; that
infrastructure failure is not counted as reproduction. The existing process
handle was missing, so the same Sandbox-only build was restarted before retrying.

## Correction

`lib/job-requests-read.ts` follows the private-analytics read pattern:
401/403 resolve to an explicitly data-less cache entry. Subsequent 503s cannot
restore the older rows. Other transient failures reject, retaining still-
authorized results and the existing retry controls. A successful later read
restores normal browsing. Requests use no-store, validate their response shape,
bound network/body reads to 15 seconds and display safe errors.

This is client-side cache hygiene, not a replacement for server authorization.
No endpoint authorization, session, company membership, publication permission,
real request, payment or credit balance is changed.

## Verification

- Nine units pass: 401/403, 429/500/503, successful schema validation, malformed
  data/JSON, timeout cleanup and no-store fetch configuration.
- Touched-file lint, diff checks and strict production-style local build pass.
- Focused local Playwright checks **2/2** pass (8.9s): both denial/outage/recovery
  sequences and the existing filter, retry, sorting, URL persistence, four-size
  scrolling/layout and read-only demo publishing checks.
- Browser scenarios use a retained isolated demo and synthetic HTTP responses;
  they do not prove a real company's membership-revocation flow.
- Existing recovery/filter/read-only-demo regression passes alongside the
  new 401→503→200 and 403→503→200 cases.

## Production acceptance

Source `b66f49f` deployed as `dpl_5PWt1ynV7w2N6KAoy8yFubwh8gjf`, passed
strict hosted build/TypeScript, with no pending migrations, and was promoted to
`www.veggat.com`. The retained live demo was verified authenticated without
creating an identity or printing session data. The same two focused browser
checks pass live (20.9s). These use synthetic responses, not real permission
revocation. Real Chrome's signed-in owner session separately loaded the actual
empty board and completed Refresh without losing the empty state or leaving
the button stuck. No request was published and the owner cart was untouched.

The testing skill informed regression-first verification and separated mocked
failure behavior from actual browser reads. The wider scoreboard remains
incomplete. Next request-board audit: dynamic detail error states, asynchronous
route changes and light-mode contrast; list coverage does not prove those paths.
