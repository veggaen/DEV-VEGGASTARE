# OAuth acceptance and recovery — 25 September 2026

## Real Chrome evidence

On the then-current Production release `38d22c9`
(`dpl_27aKdwxTHmwGc8oExXKhASRNReoi`), normal UI logout returned to the guest
login page. Google sign-in returned to the owner's existing account. A second
logout followed by GitHub sign-in also returned successfully. The GitHub session
could still open the previously paid artwork receipt, showing the original
completed capture. No extra download, charge, refund or new provider grant was
performed. Provider-dependent display names follow the existing AUTO identity
preference; this was not a new account or profile edit.

Discord reached its actual authorization screen for `veggastare`, requesting
only `identify` and `email`, with S256 PKCE and the callback
`https://www.veggat.com/api/auth/callback/discord`. New consent was not granted.
Cancel returned to `/auth/login?error=OAuthCallbackError`, but the login page
silently omitted the explanation. GitHub login subsequently restored the owner's
session. Discord's positive callback/account-link acceptance remains pending
explicit owner consent; initiation and cancellation do not prove it works fully.

## Narrow recovery fix

- Both login and the dedicated error page now use an allowlisted message helper.
  Unknown, inherited-object and private provider error values receive generic
  recovery text; no query value is rendered as diagnostics.
- Callback/cancellation feedback appears above the sign-in methods through the
  existing accessible error component. Ordinary credential errors remain with
  their form, without a duplicate OAuth error.
- No PKCE, state, CSRF, cookie, callback origin, account linking, provider scope,
  verification flag or authorization logic is changed.
- The Web Interface Guidelines review identified the missing actionable feedback
  at `frontend/app/auth/login/page.tsx:30`. Existing controls/tokens are retained;
  no new design system or long explanation is added.

36 auth-feedback/navigation/library-boundary unit checks and touched-file lint
pass. The browser regression first reproduced the missing message against the
old local build. Its final locator is scoped to the main content so Next's empty
route announcer cannot be mistaken for the customer-facing alert. The strict
production build and TypeScript pass. Visual inspection also found the existing
light-mode alert at 3.99:1 contrast. The shared form error now uses red-700 in
light mode, retaining red-400 in dark mode; its decorative icon is hidden from
assistive technology. Two focused browser checks pass locally (9.9s, no retries
or skips), covering seven error codes at 390x844 and 1280x800 in both themes,
rendered contrast >=4.5:1, no horizontal overflow, retry/reset navigation and no
page exceptions. Screenshots were visually inspected. Authentication and
permission logic is unchanged.

Source `399cb29` is READY in Production as
`dpl_DXpBMhmCt4Rf5AP7acyCjCHJhGxE`. Candidate health passed before promotion
to www.veggat.com. Four focused Live checks pass (34.3s, no retries/skips):
both auth themes, the eight-size/two-theme compact receipt and protected email
job authentication. Real Chrome repeated actual logout, Discord initiation and
Cancel: the returned login page now visibly explains recovery. Existing GitHub
sign-in then restored the account; its paid artwork receipt remains Completed
with the same capture, zero credit balance and unchanged delivery record. No
new Discord consent, account link, payment, refund, private-file download or
customer email was triggered.

## Separate findings

Settings shows a linked GitHub account as “Verified” even when its separate
trust flag is false and no unexpired confirmation is pending. This is a wording/
recovery inconsistency, not evidence that sign-in is broken or permission to
promote trust flags. It remains a separate follow-up; no trust score or payment
verification has been changed.

These checks cover the named existing-account sign-ins and error recovery, not
all provider/account combinations. Google remains unsupported in the separate
automated test browser; its positive acceptance used the actual Chrome session.
