/** @vitest-environment jsdom */
/** @fileOverview Cart concurrency, timeout, recovery and lifecycle regressions. @stability stable */
import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCartPage } from './use-cart-page';

let root: Root;
let container: HTMLDivElement;
let state: ReturnType<typeof useCartPage>;
let requests: { url: string; signal: AbortSignal; resolve: (response: Response) => void; reject: (error: Error) => void }[];
const sync = vi.fn();
const item = (id: string, quantity = 1) => ({ id, quantity, product: { id, title: id, price: 29, priceCurrency: 'NOK', image: [] } });
const cart = (items = [item('a'), item('b')]) => ({ id: 'cart', userId: 'demo', items });
function Harness({ userId = 'demo' }: { userId?: string }) {
  const result = useCartPage(userId, sync);
  useEffect(() => { state = result; }, [result]);
  return null;
}
const render = async (userId = 'demo') => { await act(async () => { root.render(React.createElement(Harness, { userId })); }); };
const respond = async (index: number, value: unknown, status = 200) => { await act(async () => { requests[index].resolve(new Response(JSON.stringify(value), { status })); }); };
const change = async (id: string, action: 'increment' | 'decrement' | 'remove' = 'increment') => { await act(async () => { void state.mutate(id, action); }); };
const load = async () => { await render(); await respond(0, cart()); };

beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); sync.mockClear(); requests = [];
  vi.stubGlobal('fetch', vi.fn((url: string, options: { signal: AbortSignal }) => new Promise<Response>((resolve, reject) => {
    requests.push({ url, signal: options.signal, resolve, reject });
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  })));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('uses the authoritative row response without an extra GET or loading flash', async () => {
  await load(); await change('a');
  expect(state.items[0].quantity).toBe(2); expect(state.loading).toBe(false);
  expect(state.pending.has('a')).toBe(true);
  await respond(1, item('a', 3));
  expect(state.items[0].quantity).toBe(3); expect(state.pending.size).toBe(0);
  expect(requests).toHaveLength(2); expect(sync).toHaveBeenLastCalledWith([item('a', 3), item('b')]);
});

it('locks repeated clicks synchronously but allows another row to proceed', async () => {
  await load(); await act(async () => { void state.mutate('a', 'increment'); void state.mutate('a', 'increment'); void state.mutate('b', 'increment'); });
  expect(requests).toHaveLength(3); expect(state.pending.size).toBe(2);
  await respond(2, item('b', 2)); await respond(1, item('a', 2));
  expect(state.items.map(i => i.quantity)).toEqual([2, 2]);
});

it('does not overwrite a different confirmed row on failure and reconciles once all settle', async () => {
  await load(); await change('a'); await change('b');
  await respond(1, {}, 503);
  expect(state.items.map(i => i.quantity)).toEqual([1, 2]); expect(requests).toHaveLength(3);
  expect(state.needsRefresh).toBe(true);
  await respond(2, item('b', 2)); expect(requests).toHaveLength(4);
  await respond(3, cart([item('a'), item('b', 2)]));
  expect(state.items.map(i => i.quantity)).toEqual([1, 2]); expect(state.needsRefresh).toBe(false);
  expect(state.error).toContain('saved cart is now shown'); expect(state.loading).toBe(false);
});

it('keeps rows on failed removal and blocks changes until a failed reconciliation is retried', async () => {
  await load(); await change('a', 'remove'); expect(state.items).toHaveLength(2);
  await respond(1, {}, 503); await respond(2, {}, 503);
  expect(state.items).toHaveLength(2); expect(state.needsRefresh).toBe(true);
  await change('b'); expect(requests).toHaveLength(3);
  await act(async () => { void state.reload(); }); await respond(3, cart());
  expect(state.needsRefresh).toBe(false); expect(state.error).toBe('');
  await change('a', 'remove'); await respond(4, { message: 'Removed' });
  expect(state.items.map(i => i.id)).toEqual(['b']); expect(requests).toHaveLength(5);
});

it('recovers from invalid initial data instead of showing a false empty cart', async () => {
  await render(); await respond(0, { items: 'invalid' });
  expect(state.loading).toBe(false); expect(state.needsRefresh).toBe(true);
  await act(async () => { void state.reload(); }); await respond(1, cart());
  expect(state.items).toHaveLength(2); expect(state.needsRefresh).toBe(false);
});

it('bounds a hung mutation and never automatically repeats a possibly committed increment', async () => {
  await load(); await change('a'); await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(requests[1].signal.aborted).toBe(true); expect(requests).toHaveLength(3);
  expect(requests[2].url).toBe('/api/cart/demo');
  await respond(2, cart([item('a', 2), item('b')]));
  expect(state.items[0].quantity).toBe(2); expect(state.needsRefresh).toBe(false);
});

it('aborts stale identity requests and ignores late mutation results', async () => {
  await load(); await change('a'); await render('other-demo');
  expect(requests[1].signal.aborted).toBe(true);
  await respond(2, { ...cart([item('other')]), userId: 'other-demo' });
  await respond(1, item('a', 9));
  expect(state.items.map(i => i.id)).toEqual(['other']); expect(state.pending.size).toBe(0);
});

it('aborts requests and clears timers on unmount', async () => {
  await render(); await act(async () => root.unmount()); root = createRoot(container);
  expect(requests[0].signal.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
});
