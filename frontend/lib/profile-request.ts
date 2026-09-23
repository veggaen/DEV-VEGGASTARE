/** @fileOverview Bounded private profile requests with actionable, non-sensitive errors. @stability stable */
export async function profileRequest(url: string) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw Object.assign(new Error(response.status === 401 ? 'Your session expired. Please sign in again.' : response.status === 404 ? 'This profile could not be found.' : response.status === 429 ? 'Too many requests. Wait a moment and try again.' : 'Could not load this section. Please try again.'), { status: response.status });
  return response.json();
}
