# Recorded marketplace walkthrough

The silent 75.72-second video records the **real Live app**, not a mockup:
public home → new temporary demo → artwork/gallery → cart → free checkout →
protected JPG download → automatic credit quote → AI workspace.

## Evidence

- Source app: `77ab6ba`, Production `dpl_5zJCViodSCcBuwHXdqA2qeBnDVqz`.
- Local focused rehearsal: **1/1**, 11.4 seconds including runner startup.
- Live recorded acceptance: **1/1**, 76.6-second test runtime.
- Native recording: VP8/WebM, 1280 × 800, 25 fps, 4,240,890 bytes, 75.72 seconds.
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
