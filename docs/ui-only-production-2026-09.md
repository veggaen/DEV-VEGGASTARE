# UI-only production release — 26 September 2026

Base: production `92c5ac7`. Only the verified Pulse keyboard/touch controls and
consent first-paint changes are included, from integrated Preview `9992a12`.
Payment code, schema/migrations, price lists, terms and dependency manifests have
zero diff from the production base. Native-currency settlement remains on the
separate `release/showcase-september` branch pending merchant acceptance.

Local build and full TypeScript pass against the isolated Preview database with
Sandbox payment credentials; no Live credentials are copied locally. Focused
consent/telemetry tests pass 36/36. Touched ESLint has zero errors and one existing
Pulse internal-navigation warning at line 2528. Whitespace checks pass.

Browser acceptance uses six scoped tests extracted from integrated commit
`9992a12` into `frontend/e2e/ui-promotion.spec.ts`, invoked against this candidate
on localhost:3000: demo privacy, responsive discovery,
Pulse keyboard/touch controls, pre-hydration consent, eight-width consent actions,
and no-JavaScript terms. Follow/post writes are intercepted; no payments or emails.
The initial cross-worktree run passed five checks but failed the terms filename
comparison because its imports referenced Preview's newer legal version. The
dedicated test imports this release's own immutable terms and checks exact bytes;
production terms have not been changed or assertions weakened.

No CSS workaround is included for blank Pulse screenshot interiors: the owner
confirmed actual posts remain visible while scrolling Explore.

Live deployment and acceptance are recorded after completion.
