import 'server-only';
import sharp from 'sharp';
import { CHAT_IMAGE_MAX_BYTES, CHAT_IMAGE_MAX_PIXELS, CHAT_IMAGE_MAX_SIDE, CHAT_IMAGE_STORED_BYTES } from './image-policy';

export async function normalizeChatImage(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > CHAT_IMAGE_MAX_BYTES) throw new Error('IMAGE_SIZE');
  // Reject SVG/PDF and other decoder formats before decoding untrusted input.
  const b = Buffer.from(bytes);
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  if (!jpeg && !png && !webp) throw new Error('IMAGE_FORMAT');
  const source = sharp(b, { failOn: 'warning', limitInputPixels: CHAT_IMAGE_MAX_PIXELS });
  const metadata = await source.metadata();
  if ((metadata.pages ?? 1) !== 1) throw new Error('IMAGE_ANIMATED');
  const result = await source.rotate().resize(CHAT_IMAGE_MAX_SIDE, CHAT_IMAGE_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }).jpeg({ quality: 80 }).timeout({ seconds: 5 }).toBuffer({ resolveWithObject: true });
  // Sharp strips EXIF/GPS and other metadata unless explicitly preserved.
  if (result.data.length > CHAT_IMAGE_STORED_BYTES) throw new Error('IMAGE_SIZE');
  return { bytes: result.data, width: result.info.width, height: result.info.height };
}
