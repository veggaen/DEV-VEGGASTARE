/**
 * @fileOverview Race-safe catalog pagination that retains usable results during refresh.
 * @stability stable
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProductsListResponseSchema, type ProductsListItem } from '@/lib/types/products';

export function useProductListing(query: string, perPage: number) {
  const [products, setProducts] = useState<ProductsListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const request = useRef<AbortController | null>(null);
  const page = useRef(0);
  const currentQuery = useRef('');
  const firstRequest = useRef(true);
  const pending = useRef(false);
  const failedPage = useRef(1);

  const fetchPage = useCallback(async (nextPage: number) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    pending.current = true;
    failedPage.current = nextPage;
    setLoading(true);
    setError(null);
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
    controller.signal.addEventListener('abort', () => window.clearTimeout(timeout), { once: true });
    try {
      const params = new URLSearchParams(query);
      params.set('page', String(nextPage));
      params.set('perPage', String(perPage));
      const response = await fetch(`/api/products?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Catalog unavailable');
      const data = ProductsListResponseSchema.parse(await response.json());
      if (controller.signal.aborted) return;
      setProducts(previous => nextPage === 1 ? data : [
        ...previous, ...data.filter(item => !previous.some(existing => existing.id === item.id)),
      ]);
      page.current = nextPage;
      currentQuery.current = `${query}|${perPage}`;
      setHasMore(data.length === perPage);
    } catch {
      if (request.current !== controller || (controller.signal.aborted && !timedOut)) return;
      setError(timedOut ? 'Products are taking longer than expected. Please try again.' : nextPage === 1
        ? 'We couldn’t update the products. Check your connection and try again.'
        : 'We couldn’t load more products. Your current results are still here.');
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller && (!controller.signal.aborted || timedOut)) {
        pending.current = false;
        setLoading(false);
      }
    }
  }, [query, perPage]);

  useEffect(() => {
    // Cancel before the debounce: a slow response cannot replace newer input.
    request.current?.abort();
    request.current = null;
    pending.current = true;
    setLoading(true);
    setError(null);
    setHasMore(false);
    const delay = firstRequest.current ? 0 : 250;
    firstRequest.current = false;
    const timer = window.setTimeout(() => { void fetchPage(1); }, delay);
    return () => { window.clearTimeout(timer); request.current?.abort(); request.current = null; };
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!pending.current && hasMore && !error && currentQuery.current === `${query}|${perPage}`) {
      void fetchPage(page.current + 1);
    }
  }, [error, fetchPage, hasMore, query, perPage]);
  const retry = useCallback(() => { if (!pending.current) void fetchPage(failedPage.current); }, [fetchPage]);
  return { products, loading, error, hasMore, loadMore, retry };
}
