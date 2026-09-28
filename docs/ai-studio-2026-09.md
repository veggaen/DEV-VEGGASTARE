# AI Studio — release evidence and operations

## Scope

`/ai/studio` adds text-to-image and text-to-video generation to the existing
Veggat credit balance. No new billing system, subscription, or automatic top-up.
It uses existing OpenAI/xAI credentials and private EdgeStore storage.
Personal API keys do not fund media yet. Demo accounts can explore the interface,
but cannot trigger paid media generation.

| Output | Provider model | Fixed request | Credits | Reserved provider budget |
| --- | --- | --- | ---: | ---: |
| PNG | `gpt-image-2.5-flare-2026-09-08` | One 1024×1024 low-quality image | 6 | US$0.05 |
| MP4 | `grok-imagine-video-1.5` | Four seconds, 480p, 16:9, silent | 80 | US$0.80 |

No reference-image upload, editing, audio track, arbitrary duration or arbitrary
model ID is accepted. Prompts are limited to 1,000 UTF-8 bytes. Results are capped
at 20 MiB. The API, not the browser, sets all billable parameters.

## Financial and privacy boundaries

- Job creation and the credit reservation share one database transaction.
- An atomic job claim permits only one paid provider start. A network retry with
  the same request UUID returns the same job; it does not call the provider again.
- Media and text share the existing daily platform budget, concurrency limits and
  per-user daily caps. Failed generations refund user credits, not provider budget.
- Private storage must succeed before settlement. Content delivery requires the
  owning signed-in account, matching environment and a completed reservation.
  Raw storage access is explicitly checked to reject anonymous reads.
- A cost above the reserved ceiling records `MEDIA_COST_REVIEW`, refunds credits
  and disables new media requests pending investigation. Never clear this flag
  without reviewing pricing and the generation record.
- Fixed prices have a review deadline of **2026-10-24 UTC**; generation fails closed
  after that date. This is an operational maintenance requirement.
- `AI_MEDIA_ENABLED=0` disables new media work. Existing results remain readable.
- Provider-level billing limits remain a separate owner-controlled protection.
  Application safeguards cannot guarantee an external provider never changes
  prices or bills an abandoned request.
- Prompts are sent to the selected provider, and prompts/results are stored for
  account history. Users are warned not to include private information. Provider
  safety rules remain enabled; generated content must be reviewed before use.

## Recovery

Image deadlines are five minutes; video deadlines are thirty minutes. Text's
two-minute stale-reservation recovery excludes media jobs. Studio reads and the
authenticated `/api/cron/ai-media` worker reconcile due jobs. Vercel runs that
worker every five minutes using the existing `CRON_SECRET`. The worker never
retries a paid POST. A lost start response therefore eventually refunds the user,
even if the provider charged the platform. Refunds remain idempotent.

Private media has no public CDN URL in browser JSON. The content route proxies
owner-authorized downloads with private/no-store, same-origin and nosniff headers.
Uploads orphaned by a process crash need an operator cleanup policy; automated
retention/deletion and image-to-video are not part of this release.

## Local evidence

Real Chrome on localhost:3000, isolated Preview database, 90 one-time QA credits:

- Image job `36c12b80-5705-454e-a5df-199d8dd1fc38`: completed PNG, 1,576,850 bytes,
  provider usage US$0.006035, one six-credit debit.
- Video job `878b4781-d424-46d2-837f-dde75539fe8c`: completed MP4, 816,133 bytes,
  provider estimate US$0.32, one eighty-credit debit. Chrome displayed the actual
  generated boat scene with a four-second player. Remaining balance: four.
- Anonymous media/history access returns 401; another signed-in account receives
  404 for the generated file. Neither can see the owner's history.
- Focused browser tests cover 360, 390, 844-landscape, 768, 1024-portrait, 1280,
  1920 and 2560 in both themes, no horizontal overflow, preserved retry identity,
  pending/failed states, refunded balance and zero-credit purchase CTA.

Both local files were downloaded through real Chrome. The PNG's dimensions and
both downloaded byte sizes match the stored output. Adding the standard download
attribute fixed a Chrome-blocked navigation; the user now stays in Studio.

## Live acceptance

Production source **2579e7e**, deployment **dpl_CXhgmxsb5YnFy3Jofmk9YqD691uH**,
promoted to **https://www.veggat.com** after the strict Vercel build, additive
migration and protected candidate health check passed. No plan/billing change.

The owner explicitly authorized one 86-credit QA grant and one image plus one
video. The grant is idempotent and separate from purchased credits. No PayPal
purchase or payment credential change was made.

- Image `e3d213ec-bfa6-4417-9431-405738eda84f`: COMPLETED, six credits, 1,479,468-byte
  PNG downloaded through real Chrome. Returned provider usage: US$0.006045.
- Video `695da477-e3e8-421d-9814-df73e0f30666`: COMPLETED, eighty credits,
  1,062,098-byte MP4 downloaded through real Chrome. Actual playback visibly
  progressed through the four-second clip. Price-derived provider estimate:
  US$0.32; this is not a billing-statement reconciliation.
- Balance **86 → 80 → 0**, both reservations COMPLETED, no refund adjustment.
  The live UI blocks further generation with a Buy credits CTA.
- Both raw storage URLs return **403** anonymously. Anonymous application access
  returns **401**; a different signed-in demo account receives **404** for each
  actual live result and cannot see it in history.
- Local and live each pass the focused Studio responsive/recovery test and the
  API access test, plus the permanent-product input/layout regression. A separate
  live video ownership check passes. Eight viewport sizes, both themes; mobile
  history selection brings the preview and Download action into view.
- **64 database/lifecycle test cases** pass with the isolated PostgreSQL tests
  enabled, plus **76 focused unit cases** (overlapping coverage, not 140 distinct
  tests). Build/typecheck pass locally and on Vercel. Touched lint has no errors;
  the privacy page retains a pre-existing navigation warning.
- `/api/health` returns 200; unauthenticated media and cron routes return 401.
  `CRON_SECRET` is present in Production. The five-minute schedule was accepted
  by deployment, but scheduled recovery execution has not yet been independently
  observed; deadline/refund behavior is covered in tests.

Live browser artifacts: `test-results-release-media-live-final`,
`test-results-release-media-product-live`, and
`test-results-release-media-video-access-live`. These generated artifacts remain
untracked. The public product description now includes Studio, with no changes
to historical order titles or paid amounts.

## Sources and design research

- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [OpenAI video API retirement](https://developers.openai.com/api/docs/deprecations):
  Sora was retired September 24, 2026; model-list presence was not treated as access.
- [xAI video generation](https://docs.x.ai/developers/model-capabilities/video/generation)
- [xAI pricing](https://docs.x.ai/developers/pricing)
- [Community Fable design reconstruction](https://github.com/ajantoniou/fable-design-system)
  and its evidence document were reviewed, along with the public UploadCheck page.
  This is a small community repository, not a verified high-star collection of
  entirely Fable-authored production apps. No such provenance claim is made.
- [Vercel Commerce](https://github.com/vercel/commerce) is an established commerce
  reference, not a Fable-authored project.

Applied principles: limited copy, one accent, clear hierarchy, balanced creation
and preview columns, stacked portrait/mobile layout, keyboard labels and focus,
44px actions, matched loading geometry and reduced-motion support. Existing Veggat
tokens/components remain; no external template or design system was installed.
