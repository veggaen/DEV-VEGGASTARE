# Messages inbox — 26 September 2026

Status: scoped inbox release verified locally, on Preview and Live. Production-safe source
`a93beac`, integrated Preview source `d276480`. This is not a whole-app release
certification or a full messaging-security audit.

## Fixes

- Missing `creatorId` on the `created`/`participated` list filters now returns
  400 before database access rather than falling through to an unrestricted
  authenticated query. Conflicting private/profile filters also fail closed.
  Explicit anonymous inbox requests return 401. Existing administrator all-list
  access is unchanged; ordinary inbox reads require ownership or membership.
- Private inbox summaries use the latest message. Pulse retains original-post
  previews. Cursor ordering has an ID tie-breaker.
- Native conversation links replace click-only cards. Row actions remain visible
  on touch screens, are named for assistive technology and have 44px targets.
  The nonexistent Edit destination is replaced with Open conversation, not a
  pretend editor. Clipboard success/failure is reported honestly.
- Deletion confirmation describes the shared effect, not just inbox removal.
  Scheduled deletion and cancellation/failure have distinct feedback. Existing
  server deletion semantics and authorization are unchanged.
- Latest activity/newest conversations replace the nonfunctional unread sort.
  Search has a distinct no-results state and Clear action. Pagination is explicit;
  loading-more errors preserve readable results. Authentication loss hides them.
  Search is limited to loaded conversations and says so while more exist.
- Account-scoped memory cache, bounded readable layout, long-name truncation,
  content visibility for long lists, token colors, no added motion or card prose.

## Local verification

- Strict build/TypeScript and touched-file ESLint pass. 17 API tests pass.
- 10 inbox browser tests pass: eight widths 360, 390, 844×390, 768, 1024, 1280,
  1920, 2560; explicit dark-theme checks, light/dark action recovery, clipboard
  denial/success, cancellation, pagination retry, permission loss, keyboard links,
  focus restoration, long names, list/footer scrolling and horizontal overflow.
- 17 existing conversation-detail recovery/race/members-panel browser checks pass.
- Six shared UI/people/Pulse/consent/legal browser regressions pass.
- UI conversation data/writes in these suites are intercepted fixtures. No
  customer conversation was changed or deleted. Early test failures were selector
  mistakes (the Next route announcer also has an alert role; the confirmation is
  a dialog, not alertdialog). Final runs have zero retries/skips.
- Separate real local HTTP checks verify anonymous denial, invalid-profile
  rejection, public feed access and private no-store inbox responses. The retained
  demo account has no private messages, so populated read behavior is covered by
  query/unit fixtures, not claimed as a real populated-account acceptance test.
- Signed-in real Chrome confirms the empty inbox and working New chat destination.
  No message was sent. Populated mobile/desktop layouts were visually inspected
  from the Playwright fixtures.

## Hosted verification

- Preview `dpl_J2x1NFosAPGmoB8TGpdnwa59pMuq` and Live
  `dpl_GQjxL8XhGKiR2pJYXcjLmfxB59ZA` are Ready. Live aliases `www.veggat.com`.
  The Production build found 56 migrations with none pending; the integrated
  Preview-only native-currency/payment work was not promoted.
- Each environment passes 10 inbox and 17 conversation recovery browser checks.
  Live also passes all six shared UI regressions (33 scoped checks total).
  Preview passes five common shared checks plus its matching-tree terms check.
- The first Preview checks reached the previous deployment during alias
  propagation. After the new API guards were visible, the full inbox rerun passed
  without retries or skips. The first shared terms test used the Production
  source's older terms version; the matching Preview source then passed the
  byte-exact terms download check. One intermediate command targeted a config
  absent from the integrated tree; a dedicated ignored config resolved this.
- Unmocked HTTP checks pass on all three targets: anonymous inbox 401, missing
  target/conflicting filters 400, public feed readable, authenticated inbox
  private/no-store. These use the retained demo account with an empty inbox.
- In real signed-in Chrome on Live, the owner's populated two-conversation inbox
  shows current previews. Latest activity/newest sorting changes their order.
  The row menu exposes working destinations and the shared-deletion warning.
  Deletion was **cancelled**, and both conversations remain. No customer data
  was mutated. The final sort is Latest activity.
- Redacted Gitleaks scan of the scoped runtime commit passes.

## Remaining

Actual new-message/send delivery, realtime notifications and the header Messages
dropdown need their next focused interaction pass. Inbox search is not a global
server search; unread tracking and a conversation editor are not implemented by
this slice. Mutation security/rate limits require separate audit. No payment,
pricing, credit-balance, auth-cookie or database-schema change is included.

The testing and web-design-guidelines skills guided the read-first audit, native
links, named touch controls, restrained copy, focus recovery and scroll tests.
[Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
was the current review reference.
