# Request board QA — 24 September 2026

## Scope

S8 request browsing and safe demo presentation, not a claim that the complete
experimental publishing workflow is finished. No payment, database, role or
server authorization changes are included.

## Reproduced and corrected

- `frontend/app/(protected)/jobs/page.tsx`: a failed request used to become
  “No requests found.” The new error state has retry; a failed refresh retains
  loaded cards. SWR keys include the signed-in account ID.
- Search and sort have visible labels, 44px controls and keyboard focus styles.
  URL filters survive reload without a server navigation per keystroke.
- Cards use existing theme tokens, bounded layouts and sized thumbnails. The
  first 50 are rendered initially; Show more reveals the next batch. Budgets
  use the shared selected fiat (crypto) display, preserving the existing USD
  source interpretation used by request details.
- `frontend/app/(protected)/jobs/post/page.tsx`: demo visitors now see an honest
  read-only preview instead of an unusable publishing form. Upload/form hooks
  mount only for a signed-in, non-demo account. Removed full user/form/result
  console logging from this page and check the session before uploads.

The UI audit followed the [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md).
URL-only filter updates follow Next's supported
[native History API integration](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api).

## Verification

- Regression first failed against the original page: no error alert appeared.
- Focused local browser batch passed 3/3, including setup: forced 503/retry,
  failed refresh retaining cards, sort, search/clear, URL reload, selected
  USD (ETH) budgets, 360/390/1280/2560 geometry, scrolling and no demo uploads
  or publishing. The shared EdgeStore initialization is not an upload.
- Existing global currency browser regression still passes through catalog,
  cart, checkout, demo receipt, orders, pricing and request detail.
- Touched-file lint and strict production-style webpack/TypeScript build pass.
- Real Chrome: retained demo, actual empty response, 390px page and mobile
  drawer scrolling visually checked; footer appears at the page bottom.
  The initial visual pass identified a cramped refresh icon and default-color
  card borders; corrected using spacing and the existing border token.
- Final styled build/type-check/lint and local browser batch pass **3/3**.
  Real Chrome confirms the corrected 390px and 1280px layouts and navigation
  into/out of the demo publishing preview. Preview deployment verification is pending.

## Remaining experimental publishing audit

- Document attachments currently serialize browser-only blob URLs, which are
  not durable downloads. Do not claim attachment publishing verified.
- The image helper still logs upload metadata and swallows upload failure.
  Real publishing needs progress/retry and error recovery tests.
- Normal publishing fields need a complete label/touch/validation pass.
- Detail fetch errors and private-company visibility queries need their own
  focused tests. No permission widening was performed in this UI slice.
