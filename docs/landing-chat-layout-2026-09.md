# Homepage chat layout acceptance — 25 September 2026

## Scope and findings

The public walkthrough exposed a clipped welcome message in the landing-page
chat. The empty conversation ran the same scroll-to-end effect as a reply. Its
fixed-height, vertically centered content could also overflow above its scroller.
The baseline browser test reproduced this at 360px: heading top 459.5px versus
scroller top 499px. Expanding the panel exposed a separate stacking-context bug:
the sticky site header intercepted the Close button.

`LandingChatWidget.tsx` now follows replies only, lets the welcome content keep
its natural minimum height, and omits the reply-end spacer for an empty chat.
Expanded chat uses the existing shared Radix Dialog: body portal, modal focus,
Escape handling and focus restoration. The model sheet remains a nested dialog;
Escape closes that sheet without closing its parent. The transcript contains
overscroll; the composer stays outside its scroll region.

No payment, authentication, provider routing, credit or refund logic changed.
No additional provider generation or financial transaction is part of these tests.

## Verification

The focused tests in `frontend/e2e/suite.spec.ts` cover:

- Anonymous dark and light themes at 360×800, 390×844, 844×390, 768×1024,
  1024×1366, 1280×800, 1920×1080 and 2560×1440.
- Visible welcome geometry, no horizontal page overflow, actual panel scrolling,
  suggested-prompt selection without sending, expansion and close.
- Nested model-picker Escape and keyboard focus returning to Expand.
- No artificial empty-panel scrollbar where the welcome content fits.
- A browser-intercepted long SSE reply still scrolls its last line into view.
  This fixture verifies rendering, not a real provider response or billing.
- Existing pre-JavaScript homepage content and anonymous model-picker checks.

The initial corrected local run passed 4/4. Visual inspection found the cookie
banner could mount after the test's conditional dismissal; the test now waits for
and dismisses it explicitly before taking layout screenshots. Real Chrome also
verified the signed-in nested picker, Close and focus restoration with normal
motion. The final local run passes **4/4** in 32.7 seconds; strict production
build, TypeScript and touched-file lint pass. Final screenshots were inspected
with the consent banner dismissed. Expanded empty chat has no artificial
scrollbar; compact chat can scroll its suggestions while preserving its heading
and pinned composer. Artifacts: `test-results-release-landing-welcome-local-final`.

Published source `f5fcf37`, Production `dpl_DbWCX7nrZR7dYj8CkqGW1Wd5dM8x`
(`dev-veggastare-zyqsltlld-v3ggas-projects.vercel.app`) passed the Vercel strict
build/TypeScript and candidate health before promotion to www.veggat.com. The
same four focused checks pass Live **4/4**, 38.9 seconds, retries disabled. Live
health is healthy. Artifacts: `test-results-release-landing-welcome-live`.
Real Chrome verified the deployed signed-in dialog at 390px, its nested model
picker and Close action, without sending a message. Temporary viewport overrides
were reset. The stable Sandbox Preview was not redeployed for this UI-only slice.

The review follows the existing app's design system and the
[Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
for modal focus, overflow, reduced motion and empty states. Physical-phone keyboard
behavior and the complete app audit are not established by these desktop tests.

## Reproduce

Against the existing isolated Sandbox local server on port 3000:

```powershell
cd frontend
$env:E2E_LANDING_CHAT_LAYOUT='1'
$env:E2E_BASE_URL='http://localhost:3000'
node node_modules/@playwright/test/cli.js test --project=no-auth --no-deps --grep='S7 landing chat|anonymous AI model selector|homepage content renders before' --retries=0
```

After deployment, repeat with `E2E_BASE_URL=https://www.veggat.com`.
No account, paid generation, purchase or refund is needed.
