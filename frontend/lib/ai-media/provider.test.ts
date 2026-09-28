import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai-chat/generation', () => ({ platformAiKey: () => 'test-not-a-real-key' }));
import { boundedMediaBytes, generateImage, readVideo, startVideo } from './provider';
afterEach(() => vi.unstubAllGlobals());
describe('bounded media provider adapters', () => {
  it('never retries a failed paid start or exposes provider secrets', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: 'secret provider message' }, { status: 403 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(startVideo('A paper boat')).rejects.toThrow('MEDIA_PROVIDER_ACCESS');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('fixes video duration, resolution, audio and model on the server', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ request_id: 'example-video-job-123' })); vi.stubGlobal('fetch', fetcher);
    expect(await startVideo('A paper boat')).toBe('example-video-job-123');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ model: 'grok-imagine-video-1.5', prompt: 'A paper boat', duration: 4, aspect_ratio: '16:9', resolution: '480p', generate_audio: false });
  });
  it('does not download rejected, wrong-duration or arbitrary-host results', async () => {
    for (const video of [{ respect_moderation: false, duration: 4, url: 'https://vidgen.x.ai/a' }, { respect_moderation: true, duration: 12, url: 'https://vidgen.x.ai/a' }, { respect_moderation: true, duration: 4, url: 'https://127.0.0.1/a' }]) {
      const fetcher = vi.fn().mockResolvedValue(Response.json({ status: 'done', model: 'grok-imagine-video-1.5', video })); vi.stubGlobal('fetch', fetcher);
      await expect(readVideo('example-video-job-123')).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('bounds downloads even when Content-Length is omitted', async () => {
    await expect(boundedMediaBytes(new Response('12345'),4)).rejects.toThrow('MEDIA_FILE_TOO_LARGE');
  });
  it('returns pending without making another paid call', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ status: 'pending' })); vi.stubGlobal('fetch', fetcher);
    expect(await readVideo('example-video-job-123')).toEqual({ status: 'pending' });
    expect(fetcher.mock.calls[0][1].method).toBe('GET');
  });
  it('fixes image count, format, size, quality and keeps moderation enabled', async () => {
    const png = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a','hex').copy(png); png.writeUInt32BE(1024,16); png.writeUInt32BE(1024,20);
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [{ b64_json: png.toString('base64') }], usage: { input_tokens: 10, output_tokens: 196, input_tokens_details: { text_tokens: 10, image_tokens: 0 } } })); vi.stubGlobal('fetch', fetcher);
    expect((await generateImage('A quiet lake')).actualMicroUsd).toBe(5930);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ n: 1, size: '1024x1024', quality: 'low', output_format: 'png', moderation: 'auto' });
  });
});
