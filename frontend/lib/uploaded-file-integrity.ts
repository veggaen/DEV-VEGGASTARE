/** @fileOverview Bounded SHA-256 integrity check of actual uploaded bytes. @stability stable */
import 'server-only';
import { createHash } from 'node:crypto';

export async function hashUploadedFile(response: Response, expectedSize: number) {
  if (!Number.isInteger(expectedSize) || expectedSize <= 0 || expectedSize > 100 * 1024 * 1024 || !response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error('Uploaded file unavailable');
  }
  const hash = createHash('sha256'), reader = response.body.getReader();
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > expectedSize) throw new Error('Uploaded file length mismatch');
      hash.update(value);
    }
    if (size !== expectedSize) throw new Error('Uploaded file length mismatch');
    return hash.digest('hex');
  } finally {
    await reader.cancel(); reader.releaseLock();
  }
}
