import 'server-only';
import { z } from 'zod';
import { MEDIA_MODELS, MEDIA_MAX_BYTES, imageCostMicroUsd, videoResultUrl } from './policy';
import { platformAiKey } from '@/lib/ai-chat/generation';

export class MediaProviderError extends Error {
  constructor(public code: string) { super(code); }
}
export async function boundedMediaBytes(response: Response, max = MEDIA_MAX_BYTES) {
  if (!response.ok || !response.body) throw new MediaProviderError('MEDIA_FILE_UNAVAILABLE');
  if (Number(response.headers.get('content-length') ?? 0) > max) throw new MediaProviderError('MEDIA_FILE_TOO_LARGE');
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length;
      if (size > max) throw new MediaProviderError('MEDIA_FILE_TOO_LARGE'); chunks.push(value); }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
async function providerJson(url: string, key: string, body?: unknown, timeout = 20_000) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', redirect: 'error', cache: 'no-store',
    signal: AbortSignal.timeout(timeout), headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  // No automatic POST retry: a lost response may still have been billed upstream.
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403 ? 'MEDIA_PROVIDER_ACCESS' :
      response.status === 429 ? 'MEDIA_PROVIDER_LIMIT' : response.status === 400 ? 'MEDIA_REQUEST_REJECTED' : 'MEDIA_PROVIDER_FAILED';
    await response.body?.cancel(); throw new MediaProviderError(code);
  }
  return JSON.parse((await boundedMediaBytes(response)).toString('utf8')) as unknown;
}
export async function generateImage(prompt: string) {
  const response = await providerJson('https://api.openai.com/v1/images/generations', platformAiKey('OPENAI'), {
    model: MEDIA_MODELS.IMAGE.model, prompt, n: 1, quality: 'low', size: '1024x1024', output_format: 'png', moderation: 'auto',
  }, 100_000);
  const parsed = z.object({ data: z.array(z.object({ b64_json: z.string().min(10).max(14_000_000) })).length(1), usage: z.unknown() }).parse(response);
  const cost = imageCostMicroUsd(parsed.usage);
  const bytes = Buffer.from(parsed.data[0].b64_json, 'base64');
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) !== 1024 || bytes.readUInt32BE(20) !== 1024) throw new MediaProviderError('MEDIA_INVALID_FILE');
  return { bytes, actualMicroUsd: cost };
}
export async function startVideo(prompt: string) {
  const data = await providerJson('https://api.x.ai/v1/videos/generations', platformAiKey('GROK'), {
    model: MEDIA_MODELS.VIDEO.model, prompt, duration: 4, aspect_ratio: '16:9', resolution: '480p', generate_audio: false,
  }, 30_000);
  return z.object({ request_id: z.string().regex(/^[a-zA-Z0-9_-]{10,160}$/) }).parse(data).request_id;
}
export async function readVideo(id: string) {
  if (!/^[a-zA-Z0-9_-]{10,160}$/.test(id)) throw new MediaProviderError('MEDIA_INVALID_JOB');
  const data = z.object({ status: z.enum(['pending','done','expired','failed']), model: z.string().optional(),
    video: z.object({ url: z.string(), duration: z.number(), respect_moderation: z.boolean() }).optional(),
    usage: z.object({ cost_in_usd_ticks: z.number().nonnegative() }).optional(),
  }).parse(await providerJson(`https://api.x.ai/v1/videos/${id}`, platformAiKey('GROK')));
  if (data.status !== 'done') return { status: data.status };
  if (!data.video || !data.video.respect_moderation || data.video.duration !== 4 || data.model !== MEDIA_MODELS.VIDEO.model) throw new MediaProviderError('MEDIA_INVALID_RESULT');
  const response = await fetch(videoResultUrl(data.video.url), { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  const bytes = await boundedMediaBytes(response);
  if (bytes.subarray(4,8).toString() !== 'ftyp') throw new MediaProviderError('MEDIA_INVALID_FILE');
  return { status: 'done' as const, bytes, actualMicroUsd: data.usage ? Math.ceil(data.usage.cost_in_usd_ticks / 10_000) : 320_000 };
}
