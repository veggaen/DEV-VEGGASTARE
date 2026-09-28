/** @vitest-environment jsdom */
/** @fileOverview Catalog cancellation, retry and pagination regressions. @stability stable */
import React, { act, StrictMode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useProductListing } from './use-product-listing';
import type { CatalogSnapshot } from '@/lib/catalog-snapshot';
import { ProductsListResponseSchema } from '@/lib/types/products';

let root: Root;
let container: HTMLDivElement;
let state: ReturnType<typeof useProductListing>;
let requests: { url: string; signal: AbortSignal; resolve: (response: Response) => void; reject: (error: Error) => void }[];
function Harness({ query = '', perPage = 2, initial }: { query?: string; perPage?: number; initial?: CatalogSnapshot | null }) {
  const result = useProductListing(query, perPage, initial);
  useEffect(() => { state = result; }, [result]);
  return null;
}
const item = (id: string) => ({ id, title: id, description: 'A product', category: 'Digital', price: 29,
  stock: 0, shipFromPostalId: '', image: [], userId: 'seller', createdAt: '2026-01-01', updatedAt: '2026-01-01', productType: 'DIGITAL' });
const render = async (query = '', perPage = 2, initial?: CatalogSnapshot | null) => { await act(async () => { root.render(React.createElement(Harness, { query, perPage, initial })); }); };
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const respond = async (index: number, ids: string[]) => { await act(async () => { requests[index].resolve(new Response(JSON.stringify(ids.map(item)))); }); };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  requests = [];
  vi.stubGlobal('fetch', vi.fn((url: string, options: { signal: AbortSignal }) => new Promise<Response>((resolve, reject) => {
    requests.push({ url, signal: options.signal, resolve, reject });
  })));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('loads once and leaves the skeleton on a successful initial response', async () => {
  await render(); expect(state.loading).toBe(true); await advance(0);
  expect(requests).toHaveLength(1); await respond(0, ['one', 'two']);
  expect(state.products.map(p => p.id)).toEqual(['one', 'two']);
  expect(state.loading).toBe(false); expect(state.hasMore).toBe(true);
  await advance(5000); expect(requests).toHaveLength(1);
});

it('aborts obsolete searches immediately and ignores late responses', async () => {
  await render('searchTerm=old'); await advance(0);
  await render('searchTerm=new'); expect(requests[0].signal.aborted).toBe(true);
  await advance(250); await respond(1, ['new']); await respond(0, ['old']);
  expect(state.products.map(p => p.id)).toEqual(['new']); expect(state.loading).toBe(false);
});

it('retains usable cards while changing search and page size', async () => {
  await render(); await advance(0); await respond(0, ['one', 'two']);
  await render('searchTerm=next', 10);
  expect(state.products).toHaveLength(2); expect(state.loading).toBe(true);
  await advance(250); expect(requests[1].url).toContain('page=1&perPage=10');
  await respond(1, ['next']); expect(state.products.map(p => p.id)).toEqual(['next']);
});

it('retries the failed page without skipping it or duplicating items', async () => {
  await render(); await advance(0); await respond(0, ['one', 'two']);
  await act(async () => state.loadMore());
  await act(async () => requests[1].reject(new Error('Offline')));
  expect(state.products).toHaveLength(2); expect(state.error).toContain('load more');
  await advance(5000); expect(requests).toHaveLength(2); // no runaway automatic retries
  await act(async () => state.retry()); expect(requests[2].url).toContain('page=2');
  await respond(2, ['two', 'three']); expect(state.products.map(p => p.id)).toEqual(['one', 'two', 'three']);
  expect(state.error).toBeNull();
  await act(async () => state.loadMore()); expect(requests[3].url).toContain('page=3');
  await respond(3, []); expect(state.hasMore).toBe(false);
});

it('shows an actionable error for an invalid response and can recover', async () => {
  await render(); await advance(0);
  await act(async () => requests[0].resolve(new Response(JSON.stringify({ products: [] }))));
  expect(state.error).toContain('try again'); expect(state.loading).toBe(false);
  await act(async () => state.retry()); await respond(1, ['recovered']);
  expect(state.error).toBeNull(); expect(state.products[0].id).toBe('recovered');
});

it('cleans up pending debounce and in-flight requests on unmount', async () => {
  await render(); await advance(0); await render('searchTerm=next');
  await act(async () => root.unmount()); root = createRoot(container);
  await advance(5000); expect(requests).toHaveLength(1); expect(requests[0].signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('bounds a hung request and allows an explicit retry', async () => {
  vi.mocked(fetch).mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  await render(); await advance(0); await advance(15_000);
  expect(state.loading).toBe(false); expect(state.error).toContain('taking longer');
  await act(async () => state.retry()); await respond(0, ['recovered']);
  expect(state.error).toBeNull(); expect(state.products[0].id).toBe('recovered');
});

const seed = (ids = ['one', 'two']): CatalogSnapshot => ({ query: '', perPage: 2, products: ProductsListResponseSchema.parse(ids.map(item)) });

it('renders the server snapshot immediately without a duplicate hydration request', async () => {
  await act(async () => root.render(React.createElement(StrictMode, null, React.createElement(Harness, { initial: seed() }))));
  expect(state.products.map(p => p.id)).toEqual(['one', 'two']);
  expect(state.loading).toBe(false); expect(state.hasMore).toBe(true);
  await advance(5000); expect(fetch).not.toHaveBeenCalled();
  await act(async () => state.loadMore());
  expect(requests[0].url).toContain('page=2&perPage=2');
  await respond(0, ['two', 'three']);
  expect(state.products.map(p => p.id)).toEqual(['one', 'two', 'three']);
});

it('treats an empty successful server response as loaded, not a failed request', async () => {
  await render('', 2, seed([])); await advance(5000);
  expect(state.loading).toBe(false); expect(state.hasMore).toBe(false); expect(state.error).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it.each([['searchTerm=retained', 2], ['', 10]] as const)('ignores an incompatible snapshot for preserved filters/page size: %s %s', async (query, perPage) => {
  await render(query, perPage, seed()); expect(state.products).toEqual([]); expect(state.loading).toBe(true);
  await advance(0); expect(requests).toHaveLength(1);
  expect(requests[0].url).toContain(`perPage=${perPage}`);
  if (query) expect(requests[0].url).toContain(query);
});

it('refreshes seeded cards when filters change and does not reuse stale seed data on clear', async () => {
  const initial = seed(); await render('', 2, initial);
  await render('searchTerm=new', 2, initial); expect(state.loading).toBe(true); expect(state.products).toHaveLength(2);
  await advance(249); expect(requests).toHaveLength(0); await advance(1); await respond(0, ['new']);
  await render('', 2, initial); await advance(250); expect(requests).toHaveLength(2);
  await respond(1, ['fresh']); expect(state.products.map(p => p.id)).toEqual(['fresh']);
});

it('uses the normal bounded client request/retry path if the server read failed', async () => {
  await render('', 2, null); await advance(0);
  await act(async () => requests[0].reject(new Error('Offline')));
  expect(state.error).toContain('try again');
  await act(async () => state.retry()); await respond(1, ['recovered']);
  expect(state.products[0].id).toBe('recovered'); expect(state.error).toBeNull();
});
