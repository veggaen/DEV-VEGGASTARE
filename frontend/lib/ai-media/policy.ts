/** Reviewed 2026-09-25. Only these fixed, text-to-media requests can spend platform funds. */
import { z } from 'zod';
export const MEDIA_POLICY_REVIEW_BY = '2026-10-24T00:00:00Z';
export const MEDIA_MODELS = {
  IMAGE: { kind: 'IMAGE', provider: 'OPENAI', model: 'gpt-image-2.5-flare-2026-09-08', label: 'GPT Image 2.5 Flare',
    credits: 6, reserveMicroUsd: 50_000, detail: '1024 × 1024 · draft quality', mime: 'image/png', extension: 'png' },
  VIDEO: { kind: 'VIDEO', provider: 'GROK', model: 'grok-imagine-video-1.5', label: 'Grok Imagine 1.5',
    credits: 80, reserveMicroUsd: 800_000, detail: '4 seconds · 480p · silent', mime: 'video/mp4', extension: 'mp4' },
} as const;
export type MediaKind = keyof typeof MEDIA_MODELS;
export const MediaRequest = z.object({
  requestId: z.string().uuid(), kind: z.enum(['IMAGE', 'VIDEO']),
  prompt: z.string().trim().min(3).max(1000).refine(value => new TextEncoder().encode(value).byteLength <= 1000, 'Keep the prompt under 1,000 bytes.'),
}).strict();
export const MEDIA_JOB_LIMIT_MS = 30 * 60_000;
export const IMAGE_JOB_LIMIT_MS = 5 * 60_000;
export const MEDIA_MAX_BYTES = 20 * 1024 * 1024;
export function mediaPricingReviewed(now = Date.now()) { return now < Date.parse(MEDIA_POLICY_REVIEW_BY); }
export function videoResultUrl(value: string) {
  const url = new URL(value);
  // Never fetch a caller's URL, a redirect, or an arbitrary provider response host.
  if (url.protocol !== 'https:' || url.hostname !== 'vidgen.x.ai' || url.port || url.username || url.password || url.hash) throw new Error('MEDIA_INVALID_FILE');
  return url.toString();
}
export function imageCostMicroUsd(usage: unknown) {
  const parsed = z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative(),
    input_tokens_details: z.object({ image_tokens: z.literal(0), text_tokens: z.number().int().nonnegative() }) }).safeParse(usage);
  if (!parsed.success || parsed.data.input_tokens !== parsed.data.input_tokens_details.text_tokens) throw new Error('MEDIA_COST_REVIEW');
  return parsed.data.input_tokens * 5 + parsed.data.output_tokens * 30;
}
