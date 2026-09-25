# Messages recovery production acceptance — 26 September 2026

Runtime `c630ef7`, deployment `dpl_7z5cuiKYqoFNUzch5neFSNVBYKNm`, is READY and
aliased to https://www.veggat.com. Three files changed: conversation detail,
focused Playwright acceptance, and its config. Payments/schema/terms/prices are
unchanged; production has 54 migrations, none pending.

Build, TypeScript, touched-file lint and staged secret scan pass. The exact
candidate passes 17/17 browser checks locally (28.4s) and Live (53.9s), with no
retries/skips. Checks cover recoverable 503 vs unavailable 404, retry, back
navigation, delayed-read cancellation, eight widths from 360 to 2560 including
landscape, and members-sheet opening/closing/focus restoration without squeezing
the composer. Message reads are intercepted fixtures; no messages are posted.

Real signed-in Chrome additionally confirms unavailable-state recovery back to
the populated Messages inbox. Populated thread, voice and all-control acceptance
remain separate work. This scoped release is not an all-app readiness claim.
