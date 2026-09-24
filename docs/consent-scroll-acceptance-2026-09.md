# Consent controls and scrolling — September 2026

## Findings and changes

- `frontend/components/uicustom/cookie-banner.tsx`: after saving, the old
  AnimatePresence exit left the banner hit area over the page for 250ms. A
  measured first wheel targeted that departing banner and did not move the
  underlying scroller. Dismissal now unmounts immediately. Only the panel, not
  a full-width invisible wrapper, intercepts input. Its optional entrance is
  180ms/transform+opacity and disabled for reduced motion.
- Consent content has a viewport-bounded independent scroller, safe-area
  offsets, fixed action section, 44px action targets and labelled native inputs.
  Essential Only and optional analytics are presented equally. The former
  misleading Accept All action is named Allow Analytics; unsupported marketing
  tracking is not offered as an active switch or enabled in new choices.
- `frontend/components/uicustom/topbar.tsx`: preferences were available only
  inside signed-in Settings. The anonymous browser test reproduced the missing
  control. They now appear in the common drawer scroll area, without login.
  Opening waits for drawer focus release rather than an arbitrary zero-delay
  timer. Saving returns focus without scrolling the background.
- Failed localStorage writes retain a visible error and do not claim successful
  persistence. Both analytics SDKs still default to disabled. Event callbacks
  recheck persisted consent after revocation, including already-loaded SDKs.
- `frontend/lib/telemetry-policy.ts`: receipt IDs were missing from URL
  scrubbing. Receipt paths now become `/checkout/receipt/[id]`; URL credentials,
  queries and fragments are removed. Static AI-credit/new-conversation routes
  remain named correctly. This is not a claim that every telemetry field or
  dynamic application route has undergone a privacy audit.

The [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)
and animation skill informed focus, touch targets, contained scrolling and
short, reduced-motion-aware transitions. Existing tokens/components are reused.

## Evidence in progress

Focused component/privacy units: **25/25**. Touched lint and the first strict
build pass. The first current-release Pulse batch was **1/5**: a cold-load test
measured a dialog transition across an undismissed cookie banner, and other
tests could wheel over the asynchronously appearing/departing banner. Updated
tests make the ordinary Essential Only choice and await removal before their
unrelated scrolling checks; the early-hydration assertion remains unchanged.
The new consent test separately asserts an immediate first wheel after saving,
without any exit-animation wait. No overlay is forcibly removed or scroll
position assigned by the test.

The first candidate batch was **5/6**: all Pulse/header regressions passed, but
the anonymous preference-reopening scenario exposed the inaccessible menu
control described above. The final strict build and touched lint pass; final
local acceptance is **6/6 in 30.0s plus 1/1 dark replay in 5.8s**, retries disabled.
Screenshots of the 390px, short landscape and desktop panel were reviewed.
Real Chrome confirms the common menu entry. Its native zoom shortcut did not
change the measured 2498×1319 viewport/device-pixel ratio, so no 125% claim is
made; a reset shortcut was issued. Preview/live acceptance is pending. Browser
telemetry script requests are intercepted to avoid contaminating real analytics;
actual component callbacks are exercised in unit tests. Neither evidence is
represented as human traffic or field Core Web Vitals.

## Remaining mission gates

This slice does not charge PayPal, grant credits, call a model, post to Pulse or
complete remaining OAuth/wallet/Railway acceptance. Real Chrome confirmed local
empty-feed/footer scrolling. Its known viewport limitation is not counted as
phone testing. The complete route audit, physical-device keyboard and native
125% zoom remain separate checks. The read-only secondary-route inspection
confirmed the `/nexus/company` alias reaches `/companies`; it also located
unpolished Daily Deals/Member Discount placeholder pages for the next slice.
