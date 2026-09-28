# Full published terms in purchase records — 24 September 2026

## Scope

The short digital purchase record was not the complete published sales agreement.
This slice gives the nine existing sections one canonical source, makes the
public page server-rendered, and retains the full Norwegian text and an optional
withdrawal form in **new** checkout snapshots. It does not rewrite historical
records or infer that a customer received an email.

- All nine headings and 34 paragraph/bullet blocks were mechanically extracted
  from the prior page. A normalized-text SHA-256 regression guards the wording.
- The terms page has immediate text, language metadata, section anchors, visible
  keyboard focus and a bounded reading column. No entrance animation or client
  JavaScript is needed to read it, expand the form, or download the public copy.
- Checkout exposes the full terms in a new tab and a version-pinned text download
  before payment. Separate file/service requests remain initially unchecked.
- The server stores `publishedTerms: { version, language, text }` in the original
  quote. Client policy substitutions and stale consent versions are rejected.
  Existing idempotent attempts retain their original server snapshot.
- The authenticated original confirmation appends the **stored** full text.
  Its email attachment is exactly the same UTF-8 packet. New demos retain the
  text but explicitly collect no paid consent and send no email.
- Earlier records without this field keep their original bytes; the receipt
  tells the buyer that today's terms were not added to their earlier agreement.
- `/api/legal/terms?version=2026-09-24.2` serves only the exact current public
  version. Stale, duplicate or unexpected parameters return 409, never silently
  substituting different wording. It does not read accounts, grant access or
  submit a withdrawal notice. Private confirmations remain owner-scoped.
- Bundle inspection caught the complete document in checkout's JavaScript.
  The client now imports only a small delivery-policy module; the full snapshot
  remains on the server. No claim about whole-app speed follows from this change.

## Verification and release

Local focused payment/legal units: **215 passed**, with 11 opt-in cases skipped.
The real isolated-PostgreSQL checkout test separately passed all six demo/Sandbox
scenarios (122, 555 and maximum mixed cart); all synthetic writes rolled back.
Touched ESLint passed. The initial strict build found a tuple-inference issue
in the test's block count; it was fixed and the strict check passed.
Final strict production build and touched lint pass. Local browser checks cover
the public document/actual download across eight sizes (360, 390, 844 landscape,
768, 1024, 1280, 1920 and 2560), a byte-identical earlier confirmation, a new
unpaid demo order, and the isolated password buyer's initially unchecked delivery
requests/error retry (payment POST intercepted). The first no-JavaScript run
failed: the root streaming fallback hid the page behind a skeleton. A route-level
fallback alone was insufficient. The root now renders the same public legal
publication for a Proxy-owned marker, overwritten on every request. Two tests
prove caller markers cannot select another fallback or bypass protected routes.
The unchanged no-JavaScript assertions then passed. This does not claim the
whole app can function without JavaScript.

The fresh local demo-login journey hit the bounded provisioning path and did not
reach Products. Isolated DB inspection found visitor buckets of five (the daily
cap) and two accounts, consistent with that restriction. No cap/identity was
reset or spoofed. The retained local demo session had one unused daily checkout
slot and completed order `cmuf3t3by0000gst5nhcyiiiv`, with the exact full packet,
0 NOK charged, no paid consent, no paid credit grant and no email. This is not a
new paid PayPal purchase or a passing fresh local demo-login assertion.

Local 390/1280 screenshots were reviewed; real Chrome dark-mode anchor scrolling,
expanded form and bottom footer were inspected. The full packet is absent from
the final browser JavaScript chunks. The real Chrome download was 8,426 bytes,
identical to the public endpoint, SHA-256
`9b1384d14b807750e1741d494d5de3dcb6cd0ded41fbe8009c4828fa84e28568`.

Release source **`4b77afb`** is READY in both environments:

- Preview `dpl_7fmSkDDfw2c8PpL1Lv5sci6nMZpE`, explicitly assigned to the
  stable isolated Sandbox alias. **3/3** public/legacy/fresh-demo journeys
  passed (32.2 seconds), plus **1/1** password-buyer delivery-request check
  (17.5 seconds, payment POST intercepted).
- Production `dpl_3LU97pZnwY1w4Kh9W5mMZWEqDR6d`, built without promoting,
  health-checked, then promoted and read back from www.veggat.com. **3/3**
  public/legacy/fresh-demo journeys passed (32.0 seconds). New demo checkout
  includes the complete versioned packet; retry/replay creates one unpaid order.
  Real Chrome confirms the published version and expanded withdrawal form.
- Both strict Vercel builds passed with the correct separate Neon hosts and
  48 existing migrations, none pending. Another **26 auth/security units**
  pass, bringing disjoint focused unit coverage for this slice to **241**.

The public no-JavaScript tests check all eight viewports, section navigation,
form expansion, footer scrolling and actual downloaded bytes. These are scoped
checks, not a claim that every app route or native 125% zoom was audited.
No new paid PayPal order/refund, historical customer email or Live secret change
was made. A CLI health command initially ran from the nested frontend directory
and auto-linked the old unrelated `frontend` Vercel project. Its newly generated
automation-bypass secret was immediately revoked by exact identity and read back
as absent; the local link was corrected. The project and its existing deployments
were not deleted. Subsequent deployment commands ran from the release root.

Pre-release original confirmation hashes (UTF-8, 3,950 bytes each):

- Local `cmuewnay20002t8t5j70s4sua`:
  `77864169acf241a7a8592d6ca9c4f9e8ea50cb5ceaebbdf17661bf337ea0bd0c`.
- Live `cmuexffq7000004lbvb9w919o`:
  `3c2b0bfaa306988f3a9607a3f2048327a7b62dfd62ac8f2dca9b356ac9ee9e52`.
- Preview `cmuex3lhb000004i9guo93zbf`:
  `a485e6fe18e1a4b5c1d7a64a7207cdbbc77d9718d1ad609244f283a5651a17ca`.

All three historical confirmation hashes remain unchanged after the release.

No migration, new secret or environment change is required. Rollback app:
`a902b42` / production `dpl_2Ed57ytaWJr1BzyuE8ueLH6F2K1F`. Retain all new
agreement snapshots and outbox records when rolling back; never rewrite them.

## Legal and operational boundary

A download does not make every refund invalid. Revocation prevents future
access; it cannot delete a saved customer file. Review mandatory rights,
defects and provider disputes separately. No automatic withdrawal refusal is
introduced, and an approved support request is not a verified refund.

The optional form follows the information fields of the government's Q-0319B
form: recipient, identified goods/services, contract/receipt date, consumer
name/address, notice date and a signature only for paper. It adds an optional
order reference and explains that downloading does not submit the notice.
See the [government's form page](https://www.regjeringen.no/no/dokument/dep/bld/skjema/skjema-2/skjema-om-angrerett/id614564/)
and its [published form source](https://www.signform.no/dss/statlige-blanketter?id=1096&view=form).

This is an engineering retention improvement, **not Norwegian legal approval**.
Have counsel check the full wording, seller details, digital-service treatment,
necessary precontract information and legally sufficient durable delivery.
Provider acceptance is not human inbox delivery. The electronic-withdrawal
commencement question and owner Live purchase/refund remain open in the linked
[delivery record](checkout-delivery-record-2026-09.md) and
[production scoreboard](production-scoreboard.md).

Layout review used the [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md).
