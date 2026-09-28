/** @fileOverview Bounded request-board reads; access denial replaces private cached rows. @stability experimental */
import { JobRequestsListResponseSchema, type JobRequestsListResponse } from '@/lib/types/job-requests';

type RequestRead = { data: JobRequestsListResponse; accessError: null } | { data: null; accessError: string };

export async function readJobRequests([url]: readonly [string, string]): Promise<RequestRead> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const unavailable = 'The request list is temporarily unavailable. Please try again.';
  const timedOut = 'The request list did not respond. Check your connection and try again.';
  try {
    let response: Response;
    try { response = await fetch(url, { cache: 'no-store', signal: controller.signal }); }
    catch { throw new Error(timedOut); }
    // SWR keeps its previous successful data when a refresh rejects. Resolve
    // denial with no rows instead, so a later outage cannot reveal them again.
    if (response.status === 401 || response.status === 403) return { data: null, accessError: response.status === 401
      ? 'Your session has expired. Sign in again to browse requests.'
      : 'This account no longer has access to these requests.' };
    if (!response.ok) throw new Error(response.status === 429
      ? 'Too many requests. Wait a minute before trying again.' : unavailable);
    try { return { data: JobRequestsListResponseSchema.parse(await response.json()), accessError: null }; }
    catch { throw new Error(controller.signal.aborted ? timedOut : unavailable); }
  } finally { clearTimeout(timeout); }
}
