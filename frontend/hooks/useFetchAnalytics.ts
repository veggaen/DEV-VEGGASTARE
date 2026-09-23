'use client';

/** @fileOverview User-scoped analytics cache with explicit retry and validated responses. @stability stable */
import useSWR from 'swr';
import { analyticsMetrics, type AnalyticsMetricKey } from '@/lib/analytics/metricsRegistry';
import { parseGrowth } from '@/lib/analytics/growth';

export const useFetchAnalytics = (metric: AnalyticsMetricKey, userId: string) => {
  const result = useSWR([analyticsMetrics[metric].endpoint, userId], async ([endpoint]) => {
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) {
      const message = response.status === 401 ? 'Your session has expired. Sign in again to view platform analytics.'
        : response.status === 403 ? 'Platform analytics are available to administrators only.'
        : response.status === 429 ? 'Too many requests. Wait a minute before trying again.'
        : 'Analytics are temporarily unavailable. Try again in a moment.';
      throw new Error(message);
    }
    try { return parseGrowth(metric, await response.json()); }
    catch { throw new Error('Analytics returned an unreadable response. Please try again.'); }
  }, { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 60_000 });
  return { data: result.data, loading: result.isLoading, refreshing: result.isValidating,
    error: result.error instanceof Error ? result.error.message : null,
    retry: () => { void result.mutate(); } };
};
