'use client';

/** @fileOverview User-scoped analytics cache with explicit retry and validated responses. @stability stable */
import useSWR from 'swr';
import { analyticsMetrics, type AnalyticsMetricKey } from '@/lib/analytics/metricsRegistry';
import { parseGrowth } from '@/lib/analytics/growth';
import { readPrivateAnalytics } from '@/lib/analytics/private-read';

export const useFetchAnalytics = (metric: AnalyticsMetricKey, userId: string) => {
  const result = useSWR([analyticsMetrics[metric].endpoint, userId, 'private-v2'], ([endpoint]) =>
    readPrivateAnalytics(endpoint, value => parseGrowth(metric, value), 'growth'),
  { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 60_000 });
  return { data: result.data?.data ?? undefined, loading: result.isLoading, refreshing: result.isValidating,
    error: result.error instanceof Error ? result.error.message : result.data?.accessError ?? null,
    retry: () => { void result.mutate(); } };
};
