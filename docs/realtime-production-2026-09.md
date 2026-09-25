# Realtime production promotion — 26 September 2026

Candidate `da0b310` carries only six realtime implementation/test files from
isolated Preview `7af0798`. Byte-for-byte comparison of those staged files against
the accepted Preview commit passed. Payment logic, prices, terms, dependencies,
schema and migrations have no changes from the prior Live UI release.

## Local acceptance

The exact production candidate was built and served on localhost:3000 using the
isolated Preview database and Sandbox payment credentials. Build/TypeScript,
touched-file ESLint and staged secret scanning pass. Nine unit tests pass.

Three browser checks pass in 8.5 seconds: guest homepage opens no realtime socket;
the actual SDK receives a simulated cart event and refreshes the cart, retaining
its channel across client navigation at 390 and 1280 pixels. Only the socket and
cart GET response are mocked; no persistent mutations or provider calls occur.
Six existing UI regression tests pass in 25.7 seconds: demo privacy, people
discovery, Pulse keyboard/touch actions, initial consent, responsive consent and
no-JavaScript terms. No retries/skips in either batch.

The hook lazy-loads the SDK for active configured subscriptions. Listener cleanup
is reference-counted per shared channel, and callback changes do not churn the
subscription. Unit tests cover shared consumers, duplicate callbacks, cleanup
before asynchronous initialization, independent channels and load failure.

## Hosted acceptance

Production `da0b310` is READY as `dpl_79qiW2P4mhYsxg4DtEhjkkGjqPEN`, aliased to
https://www.veggat.com. Vercel confirms 54 migrations, none pending; no migration
ran. Build and TypeScript passed. Live realtime acceptance passes 3/3 in 32.8
seconds, without retries/skips, using the retained demo session. No new grant.
The six broader UI regressions also pass in 33.2 seconds, without retries/skips.
Localhost was restored to the integrated Sandbox build after candidate testing.
This closes this realtime change, not the full showcase or all-route performance
audit. Remaining owner-only acceptance and native-currency activation are unchanged.
