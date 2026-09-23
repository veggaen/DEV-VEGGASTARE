'use client';

import useSWR from 'swr';
import { UserProductCreationAnalyticsResponseSchema } from '@/lib/types/analytics';

export const useFetchUserProductCreationAnalytics = (userId: string) => {
  const result = useSWR(['/api/analytics/user-product-creation', userId], async ([endpoint]) => {
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) throw new Error(response.status === 429
      ? 'Too many requests. Wait a minute before trying again.'
      : response.status === 401 || response.status === 403
        ? 'Sign in with an administrator account to view the publishing mix.'
        : 'The publishing mix is temporarily unavailable. Please try again.');
    try { return UserProductCreationAnalyticsResponseSchema.parse(await response.json()).data; }
    catch { throw new Error('The publishing mix returned an unreadable response. Please try again.'); }
  }, { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 60_000 });
  return { data: result.data, loading: result.isLoading, refreshing: result.isValidating,
    error: result.error instanceof Error ? result.error.message : null,
    retry: () => { void result.mutate(); } };
};
