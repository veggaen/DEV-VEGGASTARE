import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import sharp from 'sharp';
import { normalizeChatImage } from './normalize-image';
import { CHAT_IMAGE_MAX_BYTES } from './image-policy';
it('normalizes bounded dimensions and strips EXIF before any upload', async () => {
  const source = await sharp({ create: { width: 1200, height: 600, channels: 3, background: '#0ea57a' } }).jpeg().withMetadata({ exif: { IFD0: { Copyright: 'private-fixture' } } }).toBuffer();
  const result = await normalizeChatImage(source);
  expect(result.width).toBe(1024); expect(result.height).toBe(512);
  expect(result.bytes.byteLength).toBeLessThan(400_000);
  const metadata = await sharp(result.bytes).metadata();
  expect(metadata.format).toBe('jpeg'); expect(metadata.exif).toBeUndefined();
});
it('rejects disguised documents, malformed rasters, SVG and oversized uploads', async () => {
  for (const bytes of [Buffer.from('<svg/>'), Buffer.from('%PDF-1.0'), Buffer.from([255, 216, 255]), new Uint8Array(CHAT_IMAGE_MAX_BYTES + 1)]) await expect(normalizeChatImage(bytes)).rejects.toThrow();
});
