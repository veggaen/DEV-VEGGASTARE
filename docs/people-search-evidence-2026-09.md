# People-search privacy and acceptance

Scope: `/api/users/search`, used by team forms, messages and social pickers.
Other profile/suggestion/admin endpoints need separate acceptance; this does not
claim the entire social-data privacy surface is complete.

## Findings and change

- Demo UI disabled real-member search, but the endpoint still returned real
  people. Demo requests now return an empty result without directory queries.
- All responses, including errors, are private/no-store. Account-based read
  throttling now returns 429 with Retry-After. It reuses the existing limiter;
  its in-memory fallback is not a globally guaranteed anti-enumeration cap.
- Results are limited to 20, exclude ephemeral demos, have stable name/id order,
  and treat percent/underscore input literally rather than as SQL wildcards.
- Ordinary viewers receive shared/own email only and no platform role. Missing
  email visibility fails closed. Current admin/owner visibility is preserved.
- The auth callback already refreshes user identity/role from the database on
  each request. This audit did not reproduce a stale-role exploit.
- Empty/short searches avoid result and follow queries. Nonempty results load
  independent follow aggregates concurrently. Error logs omit raw provider data.

## Verification

- New specification suite before changes: 21 failures, 1 pass. These include new
  privacy/boundary/response requirements, not 21 independent vulnerabilities.
- Final units: 22/22. Real PostgreSQL: 7/7 in a unique disposable
  `qa_people_search_*` schema on isolated Preview. Verified hidden-email search,
  own/shared/admin visibility, demo isolation, exact prefix, limits and literal
  wildcard characters. Schema removed and absence checked. Initial database
  fixture omitted the EmailDisplayMode enum; fixture corrected before acceptance.
- Touched endpoint/test lint and strict production-style local build pass.
- Final local browser: 4/4, 11.0s, no retries/skips. Covers real API anonymous/demo
  boundaries, responsive team controls, demo messaging and intercepted composer
  search/send failures. First run 3/4: old composer fixture did not refresh its
  server-rendered demo session; fixed by waiting for hydration and refreshing
  the intercepted session. No message was sent to a real member.
- Real Chrome local signed-in normal-account search returns results; hidden
  addresses stay omitted. Search cleared; no conversation created.
- Preview/live deployment and acceptance: pending.

Reports: `frontend/test-results-release-people-search-local-final/results.json`.
