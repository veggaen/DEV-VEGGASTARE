# Recorded marketplace walkthrough

The silent 75.72-second video records the **real Live app**, not a mockup:
public home → new temporary demo → artwork/gallery → cart → free checkout →
protected JPG download → automatic credit quote → AI workspace.

## Evidence

- Source app: `77ab6ba`, Production `dpl_5zJCViodSCcBuwHXdqA2qeBnDVqz`.
- Local focused rehearsal: **1/1**, 11.4 seconds including runner startup.
- Live recorded acceptance: **1/1**, 76.6-second test runtime.
- Native recording: VP8/WebM, 1280 × 800, 25 fps, 4,240,890 bytes, 75.72 seconds.
- SHA-256: `17cd3b5cd58206c03c0d816510e7696f3f18f849852d176480d66e04616d6a63`.
- Live order is explicitly `DEMO / COMPLETED`, capture ID null, payment null.
  The recording's account is a new temporary USER; no owner session was used.
- Actual JPG download completed with the expected filename. This acceptance does
  not substitute for the separate signed-link access-control tests.
- The quote changes to 1,000 credits without an Update button. No credits are bought
  or spent, and the AI workspace is shown without fabricating a response.
- No JavaScript exceptions, horizontal overflow, PayPal requests, paid-checkout
  POSTs or AI-generation POSTs occurred. The test blocks those requests and fails
  if any are attempted; it does not mock successful payment/provider responses.
- The first local rehearsal had a test-only NOK expectation despite default USD
  display. Corrected to the actual selected USD zero amount; pricing was unchanged.

Artifacts: `frontend/test-results-release-walkthrough-{local-final,live}`.
Reviewed the recording's product, receipt and quote screenshots. Caption and text
alternatives describe the silent flow without implying a real payment.

Local public-player acceptance also passes **1/1**: native Space-key playback,
all nine caption cues, complete end-to-end decoding, no video request before Play,
and no horizontal overflow at 390×844, 844×390, 1280×800 and 2560×1440. Real Chrome
also played it with visible captions and no decoder error. Phone and desktop
player screenshots were inspected.

Publication: source `d2f8c87`, deployment `dpl_74FcTAtrnRkevSGjUtgERSb1HH6s`
(`dev-veggastare-3epyolyt5-v3ggas-projects.vercel.app`) passed strict build,
TypeScript and candidate health, then was promoted to www.veggat.com. Live player
acceptance passes **1/1** with the same full-playback/four-size/caption checks.
Real Chrome plays the published video. Public video/VTT and frontend health are
200, and the served video checksum matches the reviewed artifact above. Preview
was not redeployed for these static interview assets. No runtime payment/auth code
or database schema changed.

## Separate UI finding for the next slice

`frontend/components/uicustom/home/LandingChatWidget.tsx:234` — the auto-scroll
effect runs for an empty conversation. At 1280×800, local welcome-title top is
519.75px while its scroller begins at 552px, with scrollTop 44: the title is
clipped on entry. The recording preserves this actual behavior rather than hiding
it in edited footage. Fix and retest empty-panel alignment separately from the
walkthrough publication; sending a paid message is unnecessary for that check.

Review reference: [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
(25 September 2026), particularly empty states, overflow, captions and keyboard controls.

## Re-record

Run against the existing local server first. This deliberately consumes one normal
demo signup per run; never reset or bypass the daily signup limit to obtain footage.

```powershell
cd frontend
$env:E2E_RECORD_SHOWCASE='1'
$env:E2E_BASE_URL='http://localhost:3000'
npx playwright test --project=no-auth --no-deps --grep='S9 recorded showcase' --retries=0
# After local acceptance, record the existing Live build at normal presentation pace:
$env:E2E_BASE_URL='https://www.veggat.com'
$env:E2E_RECORD_SHOWCASE_PACED='1'
npx playwright test --project=no-auth --no-deps --grep='S9 recorded showcase' --retries=0
```

Review the entire footage for unexpected private content before publishing. Update
the VTT timestamps and this evidence if timing/content changes. The player loads no
video bytes until requested, uses native keyboard-accessible controls, and has no
third-party scripts or telemetry.

This is an interview introduction, not evidence of all-feature production readiness.
Live refund acceptance remains on hold for separate owner approval and merchant
funding/hold resolution. The recording does not approve, request or submit a refund.
