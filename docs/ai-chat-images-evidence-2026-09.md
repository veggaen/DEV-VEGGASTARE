# Private chat images — 26 September 2026

Status: **local verified; hosted release pending.** This extends the already-Live
[clean chat canvas](ai-canvas-evidence-2026-09.md). It is not an all-route readiness claim.

## Scope

- Personal private `/ai` chats accept two JPG/PNG/WebP files per message by picker,
  paste or drop. Unsent files, text and model choice stay with their conversation.
  Drafts are account-scoped, memory-only; reload/leaving the AI layout clears them.
- Explicit Send uploads; switching chats does not upload. At most ten draft files
  are retained across chats. Files are limited to 4 MB and 20 megapixels, decoded
  with Sharp, stripped of metadata, resized to 1024px and re-encoded as JPEG under
  400 KB. Unsupported/animated files fail before storage.
- Private EdgeStore bytes are served through an authenticated chat-membership
  proxy with no-store headers. Unlinked uploads are owner-only, expire after 24h,
  and cannot be reused across chats. Public sharing is blocked while images exist.
- Storage has independent daily/user/global quotas. A bounded cron claims expired
  uploads using ten-minute leases; storage locations survive failures. A foreign
  key prevents account/chat hard deletion from orphaning files. Owner permanent
  deletion first hides the chat and schedules file cleanup, then can be retried.
- Only reviewed OpenAI Luna/Astra vision models are enabled. Up to four recent
  images are included, with an explicit high-detail setting. Older omitted images
  are marked in context. Image credit/cost allowances are added to the existing
  atomic reservation and platform fuse. BYOK does not spend platform credits.
- Replies are saved only after a valid, bounded stream and explicit completion
  marker. Truncated replies preserve the draft. Retry excludes temporary messages
  to avoid duplicate image IDs. Model choice survives first-save navigation.

## Evidence

- Production build/TypeScript and touched-file ESLint pass.
- 75 unit tests across nine focused files pass: upload authorization and quotas,
  image decoding/privacy, context/cost bounds, cleanup, drafts and SSE protocol.
- 6 attachment browser checks pass at 390, 844×390, 1280 and 2560; 12 existing
  canvas checks pass at eight sizes from 360 to 2560. These intercept generation,
  session and image APIs; they test UI behavior, not real provider billing.
- One separate, unmocked local test used an ordinary isolated Preview-database
  account and a synthetic green square. GPT-5.6 Luna answered “Green”; one
  completed 3-credit reservation (16,000 micro-USD conservative reserve) left 0.
  A second request was blocked at zero. The saved image loaded; anonymous users,
  another user, another chat, public sharing and unsigned raw storage were blocked.
  No Production account, balance or payment configuration was changed.
- Real Chrome verified text draft switching. Its file chooser rejected automation
  because the extension lacks file-URL permission; this is not claimed as a passed
  real-Chrome attachment test. Synthetic image upload works in Playwright.

## Limits / follow-up

Hosted Preview/Live verification and promotion remain pending. Homepage attachment
handoff, cross-reload/cross-device drafts, other providers' vision support and
physical-device keyboard testing are not delivered by this slice. The homepage
retains its clean text composer. Participant auto-response in image chats directs
users to the priced main composer rather than silently dropping image context.

Image input pricing and bounds were reviewed against the
[OpenAI vision guide](https://developers.openai.com/api/docs/guides/images-vision),
[Luna model card](https://developers.openai.com/api/docs/models/gpt-5.6-luna) and
[Astra model card](https://developers.openai.com/api/docs/models/gpt-6-astra).
These are conservative application limits, not a provider billing guarantee.
