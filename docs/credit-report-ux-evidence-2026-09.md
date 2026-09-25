# AI-credit report UX and private-state acceptance

## Scope

The owner-only `/admin/ai-credits` report retained its original ledger queries
and server authorization. No payment, balance, grant, provider budget, refund,
database schema or deployment gate behavior changes in this slice.

Real Chrome confirmed two misleading labels in the old report: "reviewer
payments" for permanent products and "Completed messages" for reservations
which also include images/video. A baseline browser regression reproduced
loaded account figures disappearing into skeletons during refresh.

## Changes

- Spending safety and captured-payment panels precede compact credit metrics.
  Explanations and account identifiers use native keyboard/touch disclosures;
  44px controls, theme tokens, wrapping and a bounded canvas are retained.
  These choices follow the web-design-guidelines skill's
  [interface guidance](https://github.com/vercel-labs/web-interface-guidelines).
- "Completed requests" covers chat, images and video. Captures use their
  recorded NOK currency; provider reservations retain USD. Neither is described
  as profit, invoice spend or an absolute provider-side spending guarantee.
- A same-scope refresh retains prior figures with an explicit refreshing/stale
  notice. Different environments cannot render a previous environment's data;
  late responses are ignored. Initial reads alone use a matching skeleton.
- Identity/version changes remount private state. Access denial discards the
  report; a later failed retry cannot restore it. Demo/preview identities do not
  gain an owner view from a role string alone.
- Client validation rejects malformed/wrong-scope financial responses, invalid
  timestamps and unbounded account lists. It does not fabricate zero totals or
  display raw server/HTML errors.

## Verification

The existing TypeScript Playwright runner is used as the webapp-testing skill's
Python helper is unavailable. The baseline against the previous built app failed
both new assertions: refresh retention and the corrected request label. Those
failures are not passing acceptance. Thirty-five focused service/view-contract
tests, touched-file ESLint and full TypeScript pass. The strict local production
build passes.

The first updated recovery test matched both the report error and Next's route
announcer; scoping the locator to the report fixes the test ambiguity. Corrected
light acceptance passes 2/2, including scoped refresh/error/access/identity
handling, keyboard disclosure and all eight requested viewport sizes. The dark
recovery case passes, but its layout case hit the real gate's sign-in limit due
to an old duplicate sign-in block. Both tests now use the existing shared gate
helper; no authentication/rate-limit setting is changed. That incomplete dark
run is not a passing batch.

Local 1280x800 screenshot inspection confirmed the two-column safety/payment
summary and compact six-metric grid. It identified two minor polish fixes:
spacing beside the Refresh icon and singular "1 pending request" wording.
The final local build and light/dark browser batches pass **2/2 each**, zero
retries/skips. Phone screenshot review prompted a one-row environment/Refresh
toolbar, now also asserted at all eight sizes. A later dark capture had missing
header glyphs; inspecting computed ancestor styles (visible, opacity 1, light
foreground on black) and a fresh screenshot confirmed readable rendering. No
global theme/style workaround or hidden failure was introduced.

Actual local Auth.js/API/UI acceptance uses one disposable owner in the isolated
Preview database, not browser response fixtures. Real report reading, refresh,
390/1280 layout, fresh-role rejection and removal of private UI after denial all
pass. Only the disposable test user's role changed; no ledger/order/payment was
written. The exact principal was removed afterwards. The owner-report API and
report queries remain unchanged.

Runtime `92c5ac7` passed both hosted environments: **2/2 light and 2/2 dark**
in Preview and Live, with zero retries/skips. Hosted browser fixtures exercise
view recovery without granting server permissions; the actual signed-in demo
remains forbidden by the report API.

- Preview: `dpl_Dtv7BooMcrCKAuksAriubF5JPBAQ`, assigned to the existing isolated
  `dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app` alias.
- Production: `dpl_3GCyDg5BuzBghdjkSnhKut2J7cdu`, promoted to `www.veggat.com`
  after Preview acceptance. Both health checks were healthy. Their single
  database latency samples are not performance benchmarks.
- Deployment checks found 54 existing migrations with none pending. This
  release introduced no schema migration.

Real signed-in Chrome showed the actual Live owner report, including the
existing two captures totaling NOK 38 and the unchanged USD 5 daily application
ceiling. Refresh retained figures while showing progress. Safety and metric
disclosures opened and closed. The actual 1280x800 viewport showed the compact
summary; the 390x844 viewport retained a single-row environment/Refresh toolbar.
Phone-width scrolling reached the account card and normally flowing footer.
No console errors were captured. The temporary viewport was reset and the report
tab was retained for the owner. No payment, refund, email, credit grant, key or
billing setting changed during this acceptance.

## Remaining limits

This is report UX/private-state acceptance, not new accounting verification,
provider billing/cap acceptance, all-route certification or actual 125% browser
zoom/physical-phone-keyboard acceptance. Existing broader blockers remain in
the production scoreboard.
