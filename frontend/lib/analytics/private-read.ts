/** @fileOverview Bounded private analytics reads; access denial replaces cached report content. @stability stable */
type Kind = 'growth' | 'publishing';
export type PrivateAnalyticsRead<T> = { data: T; accessError: null } | { data: null; accessError: string };

export async function readPrivateAnalytics<T>(endpoint: string, parse: (value: unknown) => T, kind: Kind): Promise<PrivateAnalyticsRead<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const unavailable = kind === 'growth' ? 'Analytics are temporarily unavailable. Try again in a moment.' : 'The publishing mix is temporarily unavailable. Please try again.';
  const timedOut = 'The analytics request did not respond. Check your connection and try again.';
  try {
    let response: Response;
    try { response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal }); }
    catch { throw new Error(timedOut); }
    // Resolve denied access as a data-less cache entry, not a rejected refresh:
    // SWR retains the previous data on rejection, which is inappropriate here.
    if (response.status === 401 || response.status === 403) return { data: null, accessError: response.status === 401
      ? 'Your session has expired. Sign in again to view platform analytics.'
      : 'Platform analytics are available to administrators only.' };
    if (!response.ok) throw new Error(response.status === 429 ? 'Too many requests. Wait a minute before trying again.' : unavailable);
    try { return { data: parse(await response.json()), accessError: null }; }
    catch { throw new Error(controller.signal.aborted ? timedOut : kind === 'growth'
      ? 'Analytics returned an unreadable response. Please try again.'
      : 'The publishing mix returned an unreadable response. Please try again.'); }
  } finally { clearTimeout(timeout); }
}
