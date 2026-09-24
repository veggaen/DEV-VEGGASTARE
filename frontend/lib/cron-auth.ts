/** @fileOverview Fail-closed authentication for scheduled jobs. @stability stable */
import { timingSafeEqual } from 'node:crypto';

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // A missing/blank secret must never make a public mutation endpoint open.
  if (!secret || secret.trim().length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
