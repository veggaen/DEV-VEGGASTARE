# First-download reminder

## Scope

A concise informational dialog before a file's first download request from
My downloads, the verified receipt and legacy order view. Cancel/Escape do not
request the private file. The dialog uses the existing tokens and accessible
dialog, wraps long filenames and fits a short landscape viewport.

This is **not** a new consent checkbox, waiver, automatic refund decision or
claim that the buyer's statutory rights have ended. The copy is conditional:
consent and confirmation requirements must actually be satisfied. Existing
checkout consent, original terms, email, refund review and signed-file access
are unchanged. Clicking Download does not rewrite historical agreements.

The request count is only a convenience for deciding whether to repeat the
reminder. It is not conclusive evidence that a customer saved/opened the file
or lost withdrawal rights. A retry during the same mounted view does not show
the reminder again. Authentication and entitlement checks remain server-side.

## Legal / commercial boundary

Research, not a legal certification:

- [Angrerettloven §22(n)](https://lovdata.no/lov/2014-06-20-27/§22): the paid
  digital-content exception requires prior express consent, acknowledgment,
  the required confirmation and commencement of delivery.
- [European Commission guidance, 4.4 and 5.7](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=OJ:JOC_2021_525_R_0001):
  do not substitute pre-ticked/general-terms acceptance or a mutable web link
  for the required consent and durable confirmation. The timing matters.
- [Digitalytelsesloven](https://lovdata.no/NL/lov/2022-06-17-56): downloading
  does not erase remedies for non-conforming content.
- [PayPal Norway seller protection](https://www.paypal.com/no/legalhub/paypal/seller-protection?locale.x=en_NO):
  eligibility is conditional and does not cover every dispute/payment method.

The full evidence chain and final consumer-policy wording need Norwegian legal
review. AI services/credits are not automatically treated as downloaded files.
The owner's paid artwork refund remains unsubmitted; this slice does not
authorize or perform one.

## Verification

Local acceptance passes: strict production build/TypeScript, touched lint,
40 private storage, download entitlement and retained-agreement unit cases,
and all three focused browser checks (25.7s). The browser checks cover
first-request cancel/Escape, focus trap/return, long filenames, eight sizes in
both themes, a storage failure and retry, and a repeat download without a new
reminder. Separate free-demo checkout checks exercise the actual receipt and
private JPG transfer, without PayPal or an AI generation. Visual review at
390px, landscape 844px and ultrawide 2560px found no clipping; keyboard focus
stays in the dialog and returns to Download on cancellation. Existing expired,
revoked and exhausted download controls remain disabled. The real Chrome
local owner account's empty library was checked without replacing its login
or creating a paid order.

Local artifacts: `frontend/test-results-release-download-reminder-local/`.
Live acceptance also passes: 3/3 focused checks in 46.6s, no retries, skips or
flaky results. The real free-demo checkout and protected JPG transfer passed;
fixture-backed checks cover Cancel/Escape, focus, retry and repeat-download
behavior at eight sizes in both themes. Live mobile screenshot review found
no clipping. Artifacts: `frontend/test-results-release-download-reminder-live/`.

Source `273c162`, Production `dpl_9wGrjccRuQiJCoN37rGFHMtHsjiv` is READY and
promoted to www.veggat.com. Candidate and Live health are healthy. Real Chrome
verified the owner's signed-in library with available and expired files;
no additional owner download was requested. The owner's already-used files
are not first-download cases, so that Chrome check does not prove the new
dialog by itself. The actual first-request flow is covered by the free-demo
browser test. No paid purchase, refund, consent change or AI generation occurred.
The existing published walkthrough recording is not replaced by this fast
acceptance run.
