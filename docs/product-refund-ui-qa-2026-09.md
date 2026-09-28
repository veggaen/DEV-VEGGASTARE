# Product detail and refund follow-up — 24 September 2026

## Scope and findings

The actual desktop product view put description, delivery and repeated stock
cards into one long narrow buy box, leaving a large empty area under the image.
The credit artwork still said 100 after selecting another amount. These were
visible usability issues, not HTTP failures.

- `frontend/app/products/[...id]/ProductClient.tsx` — description now gets its own
  readable section, digital delivery is no longer duplicated, headings follow
  h1/h2/h3, long specification values wrap and the back link has visible text.
  The decorative cursor tracker is removed from the purchase flow.
- `frontend/components/uicustom/product/product-gallery.tsx` — fixed image geometry,
  selectable 44px+ thumbnails, keyboard controls, numbered images, selected state
  and a counter. Missing media gets an explicit fallback. The credit preview uses
  the confirmed exact amount, including 122, 555 and 1,000, rather than a static 100.
- `frontend/components/uicustom/skeletons/product-skeleton.tsx` — gallery/actions/
  description placeholders now follow the revised layout.

The existing tokens, shell, images and components are reused. The review followed
[Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md),
particularly meaningful controls, focus, image geometry and overflow handling.

## Verification

- Touched lint and strict production-mode local build pass.
- Three focused Playwright journeys pass locally: guest purchase/login return,
  responsive gallery/footer and editable credit-preview safety. One initial
  test incorrectly waited for a hidden mobile bar on desktop; that fixture was
  corrected without changing or weakening the layout assertion.
- Responsive loop: 360×800, 390×844, 844×390, 768×1024, 1024×1366, 1280×800,
  1920×1080, 2560×1440. No horizontal page overflow; footer links remain clear of
  the mobile purchase bar; image selection works by keyboard and pointer.
- Light-mode local screenshots inspected at 390 and 1280; dark-mode real Chrome
  inspected at 390. Actual Chrome gallery selection, End-to-footer navigation,
  drawer scrolling and closing succeeded. Temporary viewport override was reset.
- Invalid 99-credit input does not change the confirmed amount or enable purchase.
  These layout tests do not submit orders, edit the owner's cart, or charge money.
- Refund/return checks: see `paypal-refund-acceptance-2026-09.md`.

Preview `48ebacd` / `dpl_H8eb2Kb6xAhVP578H47yp55dsFNt` is READY at
`https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app`.
The same three browser journeys pass there (17.5s; local 8.6s). Real Chrome
confirms the deployed credit preview. Deployed terms render and a cross-origin
return mutation returns 403; the prior refunded receipt remains revoked.

This is not certification that all app routes,
real-device keyboards, browser zoom, Live purchases or statutory compliance pass.
Separate persisted consent and durable confirmation remain unfinished; an already
downloaded file cannot be remotely recalled, and defect/dispute rights remain.

Do not promote this branch wholesale yet: a direct comparison with production
`bfe4fd3` shows that the newer catalog-price filter and basket work is not fully
merged here. Reconcile that release difference first. No production alias or
Live payment was changed during this slice.
