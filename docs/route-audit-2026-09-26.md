# Route-by-route audit — 26 September 2026

Status: **PARTIAL — not a production-readiness certification.**

## Acceptance method

Each route needs separate evidence for permission boundaries, its happy path,
validation/errors/retry, persistence, keyboard/navigation/scroll, and responsive
layout. HTTP 200 is not feature acceptance. A demo redirect to an admin gate is
not a test of the admin page behind it. Dynamic pages require owned, foreign,
missing and unauthorized record fixtures. Historical evidence remains in the
production scoreboard; this table records this fresh pass only.

The audit uses the web-design-guidelines and webapp-testing skills. Deny-by-default
and per-request checks follow [OWASP Authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
Responsive checks follow [W3C Reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html);
viewport checks alone do not establish full WCAG conformance.

## Fresh rendering/scroll baseline

Local production build on :3000, retained isolated demo identity, real wheel input,
390×844 and 2560×1440. All 77 static URL candidates completed without horizontal
document overflow, browser page errors or HTTP 5xx. The private `_components`
folder was also probed (404), then excluded from the route extractor because it
is not an App Router URL. Admin and signed-in auth redirects are recorded explicitly.
This is triage, not a claim that all buttons or background APIs work.

| Requested route | Render/scroll at both widths | Observed destination | Feature/security acceptance in this pass |
| --- | --- | --- | --- |
| `/` | PASS (200) | `/` | PENDING |
| `/accessibility` | PASS (200) | `/accessibility` | PENDING |
| `/admin` | PASS (200) | `/gate` | PENDING |
| `/admin/ai-credits` | PASS (200) | `/gate` | PENDING |
| `/admin/audit-log` | PASS (200) | `/gate` | PENDING |
| `/admin/companies` | PASS (200) | `/gate` | PENDING |
| `/admin/moderation` | PASS (200) | `/gate` | PENDING |
| `/admin/polls` | PASS (200) | `/gate` | PENDING |
| `/admin/repo-access` | PASS (200) | `/gate` | PENDING |
| `/admin/runtime` | PASS (200) | `/gate` | PENDING |
| `/admin/setup` | PASS (200) | `/gate` | PENDING |
| `/admin/system-updates` | PASS (200) | `/gate` | PENDING |
| `/admin/users` | PASS (200) | `/gate` | PENDING |
| `/ai` | PASS (200) | `/ai` | PENDING |
| `/ai/credits` | PASS (200) | `/ai/credits` | PENDING |
| `/ai/studio` | PASS (200) | `/ai/studio` | PENDING |
| `/analytics` | PASS (200) | `/analytics` | PENDING |
| `/analytics/companies` | PASS (200) | `/analytics/companies` | PENDING |
| `/analytics/crypto` | PASS (200) | `/analytics/crypto` | PENDING |
| `/analytics/products` | PASS (200) | `/analytics/products` | PENDING |
| `/analytics/users` | PASS (200) | `/analytics/users` | PENDING |
| `/auth` | PASS (200) | `/` | PENDING |
| `/auth/error` | PASS (200) | `/settings` | PENDING |
| `/auth/login` | PASS (200) | `/nexus` | PENDING |
| `/auth/new-password` | PASS (200) | `/nexus` | PENDING |
| `/auth/new-verification` | PASS (200) | `/auth/new-verification` | PENDING |
| `/auth/register` | PASS (200) | `/nexus` | PENDING |
| `/auth/reset` | PASS (200) | `/nexus` | PENDING |
| `/auth/security-action` | PASS (200) | `/auth/security-action` | PENDING |
| `/cart` | PASS (200) | `/cart` | PENDING |
| `/checkout` | PASS (200) | `/checkout` | PENDING |
| `/checkout/return` | PASS (200) | `/checkout/return` | PENDING |
| `/client` | PASS (200) | `/client` | PENDING |
| `/community-guidelines` | PASS (200) | `/community-guidelines` | PENDING |
| `/companies` | PASS (200) | `/companies` | PENDING |
| `/companies/create` | PASS (200) | `/companies/create` | PENDING |
| `/company` | PASS (200) | `/companies` | PENDING |
| `/contact` | PASS (200) | `/info` | PENDING |
| `/conversations` | PASS (200) | `/conversations` | Management/visibility candidate in verification |
| `/conversations/new` | PASS (200) | `/conversations/new` | Scoped creation checks below |
| `/dashboard` | PASS (200) | `/dashboard` | PENDING |
| `/dashboard/inventory` | PASS (200) | `/dashboard/trading` | PENDING |
| `/dashboard/paper-trading` | PASS (200) | `/dashboard/paper-trading` | PENDING |
| `/dashboard/settings` | PASS (200) | `/dashboard/settings` | PENDING |
| `/dashboard/trading` | PASS (200) | `/dashboard/trading` | PENDING |
| `/dev/chat-preview` | PASS (200) | `/dev/chat-preview` | PENDING |
| `/dev/errors` | PASS (200) | `/dev/errors` | PENDING |
| `/feed` | PASS (200) | `/pulse` | PENDING |
| `/gate` | PASS (200) | `/gate` | PENDING |
| `/info` | PASS (200) | `/info` | PENDING |
| `/jobs` | PASS (200) | `/jobs` | PENDING |
| `/jobs/post` | PASS (200) | `/jobs/post` | PENDING |
| `/my-downloads` | PASS (200) | `/my-downloads` | PENDING |
| `/my-orders` | PASS (200) | `/my-orders` | PENDING |
| `/my-sales` | PASS (200) | `/my-sales` | PENDING |
| `/my-sales/requests` | PASS (200) | `/my-sales/requests` | PENDING |
| `/nexus` | PASS (200) | `/nexus` | PENDING |
| `/nexus/company` | PASS (200) | `/companies` | PENDING |
| `/nexus/company/create` | PASS (200) | `/companies/create` | PENDING |
| `/nexus/company/job-ask` | PASS (200) | `/jobs/post` | PENDING |
| `/nexus/company/job-box` | PASS (200) | `/jobs` | PENDING |
| `/notifications` | PASS (200) | `/notifications` | PENDING |
| `/order-confirmation` | PASS (200) | `/order-confirmation` | PENDING |
| `/poll-test` | PASS (200) | `/poll-test` | PENDING |
| `/pricing` | PASS (200) | `/pricing` | PENDING |
| `/privacy` | PASS (200) | `/privacy` | PENDING |
| `/products` | PASS (200) | `/products` | PENDING |
| `/products/create` | PASS (200) | `/products/create` | PENDING |
| `/products/daily-deals` | PASS (200) | `/products/daily-deals` | PENDING |
| `/products/member-discount` | PASS (200) | `/products/member-discount` | PENDING |
| `/profile` | PASS (200) | `/profile/[own-id]` | PENDING |
| `/pulse` | PASS (200) | `/pulse` | PENDING |
| `/server` | PASS (200) | `/server` | PENDING |
| `/settings` | PASS (200) | `/settings` | PENDING |
| `/settings/verify-paypal` | PASS (200) | `/settings/verify-paypal` | PENDING |
| `/terms` | PASS (200) | `/terms` | PENDING |
| `/warehouses` | PASS (200) | `/warehouses` | PENDING |

## Dynamic routes needing their own record fixtures

- `/admin/companies/[companyId]` — PENDING fresh full feature/security acceptance.
- `/admin/companies/[companyId]/edit` — PENDING fresh full feature/security acceptance.
- `/admin/users/[userId]` — PENDING fresh full feature/security acceptance.
- `/ai/[id]` — PENDING fresh full feature/security acceptance.
- `/checkout/receipt/[id]` — PENDING fresh full feature/security acceptance.
- `/companies/[id]` — PENDING fresh full feature/security acceptance.
- `/companies/[id]/hub` — PENDING fresh full feature/security acceptance.
- `/companies/[id]/settings` — PENDING fresh full feature/security acceptance.
- `/company/[companyId]` — PENDING fresh full feature/security acceptance.
- `/conversations/[id]` — management/visibility candidate in verification; remaining features PENDING.
- `/jobs/[id]` — PENDING fresh full feature/security acceptance.
- `/nexus/company/[companyId]` — PENDING fresh full feature/security acceptance.
- `/nexus/company/[companyId]/hub` — PENDING fresh full feature/security acceptance.
- `/nexus/company/[companyId]/settings` — PENDING fresh full feature/security acceptance.
- `/nexus/company/[companyId]/warehouse/[warehouseId]` — PENDING fresh full feature/security acceptance.
- `/nexus/company/[companyId]/warehouse/[warehouseId]/orders` — PENDING fresh full feature/security acceptance.
- `/nexus/company/job-box/[id]` — PENDING fresh full feature/security acceptance.
- `/order-confirmation/[id]` — PENDING fresh full feature/security acceptance.
- `/products/[...id]` — PENDING fresh full feature/security acceptance.
- `/products/edit/[id]` — PENDING fresh full feature/security acceptance.
- `/profile/[userId]` — PENDING fresh full feature/security acceptance.
- `/pulse/[id]` — PENDING fresh full feature/security acceptance.
- `/trade/[tradeId]` — PENDING fresh full feature/security acceptance.
- `/warehouses/[...id]` — PENDING fresh full feature/security acceptance.

## Completed and deployed slice: conversation creation

- Same-origin JSON-only bounded requests; demo and impersonation writes denied.
- Durable per-user/IP throttles plus the burst limiter; fail closed on outage.
- Current session version checked under a database identity lock.
- No hidden-email lookup or silent removal of unavailable recipients.
- New direct/group chats must use participants-only visibility. DM is an exact pair.
- New conversation, initial message and counters commit atomically.
- Actor-scoped stable request IDs preserve retries; changed-payload replay rejected.
- Cross-initiator DM creation serialized using a transaction advisory lock.
- Existing DM receives the submitted first message exactly once; permissions are
  rechecked after acquiring its row lock.
- Public realtime contains only the new public thread ID; private threads do not
  emit public-feed events. Realtime outage cannot turn a committed write into a failure.
- Generic server failures and private/no-store responses; no message/title logging.
- Composer preserves drafts on failed starts and reuses the request ID until edited.
- Gray form borders and neutral visible input focus; touch-sized controls retained.

Verification: 66 focused unit tests; real isolated-database test with two disposable
password users verified reciprocal concurrent DM starts, group replay, initial
message counters, private-email rejection and public-DM rejection. Fixture users
and their test conversations/messages were removed afterward. No real member was
contacted. Six scoped Playwright checks cover failure/retry/navigation at 360,
390, 844-landscape, 1280 and 2560 plus anonymous/demo denial. Each passed in both
light and dark themes locally, on Preview and Live (12 per environment). Real
Chrome confirms mobile scroll, compact desktop spacing and a neutral 2px Live
focus boundary. Desktop submit controls do not overlap the draft field.
Runtime `48b7f03`, Live deployment `dpl_8Z2gQ1mcg2bM54dsjSG7VNdfdvw8`;
Preview deployment `dpl_25MvvrYm7cgg7FD9pnMGEKp4hYmx`. Hosted mutations are
intercepted client fixtures; the real server remains read-only demo. Actual
write/concurrency evidence comes from the isolated-database test above.

## Next acceptance queue

1. Finish [management/visibility verification](conversation-management-evidence-2026-09.md),
   then reaction/repost, flags/pins and other metadata endpoints. Historical private
   attachments remain pending; creation/management checks do not certify these endpoints.
2. Remaining dynamic record paths, including owned/foreign/missing records and
   meaningful empty/error states, then all displayed actions in each static family.
3. Auth/admin/seller role-specific passes, real phone keyboard and native zoom.
4. Remaining external-provider/payment checks already marked incomplete in the
   scoreboard; do not infer success from this route scan.

No database schema, PayPal credentials, prices or credit policies were changed.
