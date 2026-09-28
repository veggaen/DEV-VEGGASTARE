/** @fileOverview Validated, account-scoped request detail reads and safe display helpers. @stability experimental */
import { JobRequestDtoSchema, type JobRequestDto } from '@/lib/types/job-requests';

type DetailRead = { data: JobRequestDto; problem: null } | { data: null; problem: { kind: 'missing' | 'access'; message: string } };

export async function readJobRequest([url, , id]: readonly [string, string, string]): Promise<DetailRead> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const unavailable = 'This request is temporarily unavailable. Check your connection and try again.';
  try {
    let response: Response;
    try { response = await fetch(url, { cache: 'no-store', signal: controller.signal }); }
    catch { throw new Error(unavailable); }
    if ([401, 403, 404].includes(response.status)) return { data: null, problem: {
      kind: response.status === 404 ? 'missing' : 'access',
      message: response.status === 401 ? 'Your session has expired. Sign in again to view this request.'
        : response.status === 403 ? 'This account does not have access to this request.'
        : 'This request may have been removed or is no longer available.',
    } };
    if (!response.ok) throw new Error(response.status === 429 ? 'Too many requests. Wait a minute before trying again.' : unavailable);
    try {
      const data = JobRequestDtoSchema.parse(await response.json());
      if (data.id !== id) throw new Error('Mismatched request');
      return { data, problem: null };
    } catch { throw new Error(unavailable); }
  } finally { clearTimeout(timeout); }
}

export function isRequestUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function isRequestImage(value: string): boolean {
  return /^\/(?!\/)[^\\\s]*$/.test(value) || isRequestUrl(value);
}

const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
export function formatRequestDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date);
}
