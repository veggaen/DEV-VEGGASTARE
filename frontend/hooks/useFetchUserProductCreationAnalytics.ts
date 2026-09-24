'use client';

import useSWR from 'swr';
import { UserProductCreationAnalyticsResponseSchema } from '@/lib/types/analytics';
import { readPrivateAnalytics } from '@/lib/analytics/private-read';

export const useFetchUserProductCreationAnalytics = (userId: string) => {
  const result = useSWR(['/api/analytics/user-product-creation', userId, 'private-v2'], ([endpoint]) =>
    readPrivateAnalytics(endpoint, value => UserProductCreationAnalyticsResponseSchema.parse(value).data, 'publishing'),
  { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 60_000 });
  return { data: result.data?.data ?? undefined, loading: result.isLoading, refreshing: result.isValidating,
    error: result.error instanceof Error ? result.error.message : result.data?.accessError ?? null,
    retry: () => { void result.mutate(); } };
};
