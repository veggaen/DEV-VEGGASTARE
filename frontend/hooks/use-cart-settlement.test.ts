/** @vitest-environment jsdom */
import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCartSettlement } from './use-cart-settlement';
import { quoteSettlementCart } from '@/lib/payments/settlement-quote';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { FUNDED_AI_MODELS } from '@/lib/ai-chat/credit-policy';
import { MEDIA_MODELS } from '@/lib/ai-media/policy';
import { SettlementClientError } from '@/lib/payments/settlement-client';

const fixture = vi.hoisted(() => ({ currency: 'NOK', request: vi.fn() }));
vi.mock('@/components/providers/ui-preferences', () => ({ useUiPreferences: () => ({ prefs: { preferredFiatCurrency: fixture.currency } }) }));
vi.mock('@/lib/payments/settlement-client', async importOriginal => ({ ...await importOriginal<object>(), settlementRequest: fixture.request }));
let root: Root, container: HTMLDivElement, state: ReturnType<typeof useCartSettlement>;
let pending: { resolve: (value: unknown) => void; reject: (error: Error) => void; signal: AbortSignal }[];
const rows = (revision = '1') => [{ id: 'row', quantity: 1, updatedAt: revision, creditAmount: 100, product: { id: SHOWCASE_PRODUCTS.credits.id } }];
function quote(credits = 100) {
  return quoteSettlementCart({ currency: 'NOK', items: [{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, credits: { type: 'credits', credits } }] },
    { now: Date.now(), modelCostReviewBy: '2026-10-24T00:00:00Z', models: [...FUNDED_AI_MODELS, ...Object.values(MEDIA_MODELS)] });
}
function Harness({ revision = '1', paused = false, empty = false }) {
  const result = useCartSettlement(empty ? [] : rows(revision), paused);
  useEffect(() => { state = result; }, [result]);
  return null;
}
const render = async (props = {}) => { await act(async () => root.render(React.createElement(Harness, props))); };
const advance = async (ms = 150) => { await act(async () => vi.advanceTimersByTimeAsync(ms)); };
const respond = async (index: number, value: unknown = { quote: quote(), token: 'test-only-token' }) => { await act(async () => pending[index].resolve(value)); };

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-25T12:00:00Z')); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  pending = []; fixture.currency = 'NOK'; fixture.request.mockReset();
  // Deliberately allow late responses despite abort to prove the active guard.
  fixture.request.mockImplementation((_path: string, _body: unknown, signal: AbortSignal) => new Promise((resolve, reject) => pending.push({ resolve, reject, signal })));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('debounces revisions and enables only a validated quote', async () => {
  await render(); expect(state.ready).toBe(false); await advance(); await respond(0);
  expect(state.ready).toBe(true); expect(state.quote?.totalMinor).toBe(3900);
  await render({ revision: '2' }); expect(state.quote).toBeNull(); expect(state.token).toBeUndefined();
  await render({ revision: '3' }); await advance(); expect(pending).toHaveLength(2);
  await respond(1); expect(state.ready).toBe(true);
});
it('does not reuse a paused quote after cart or currency changes', async () => {
  await render(); await advance(); await respond(0); await render({ paused: true }); expect(state.quote).not.toBeNull();
  await render({ paused: true, revision: '2' }); expect(state.quote).toBeNull(); expect(state.token).toBeUndefined(); expect(state.ready).toBe(false);
  await render({ paused: true }); fixture.currency = 'USD'; await render({ paused: true }); expect(state.quote).toBeNull(); expect(state.token).toBeUndefined();
});
it('rejects a valid server quote for another tab’s changed credit selection', async () => {
  await render(); await advance(); await respond(0, { quote: quote(1000), token: 'test-only-token' });
  expect(state.ready).toBe(false); expect(state.token).toBeUndefined(); expect(state.error).toContain('another tab');
});
it('ignores responses for an old cart even when the transport ignores abort', async () => {
  await render(); await advance(); await render({ revision: '2' }); expect(pending[0].signal.aborted).toBe(true);
  await advance(); await respond(1); expect(state.ready).toBe(true);
  await respond(0, { quote: null, token: 'invalid' }); expect(state.ready).toBe(true);
});
it('expires without automatically repricing or retrying', async () => {
  await render(); await advance(); await respond(0); await advance(600000);
  expect(state.ready).toBe(false); expect(state.token).toBeUndefined(); expect(state.error).toContain('expired'); expect(pending).toHaveLength(1);
  await act(async () => state.refresh()); await advance(); await respond(1); expect(state.ready).toBe(true);
});
it('keeps a submitted quote stable while its retry is locked', async () => {
  await render(); await advance(); await respond(0); await render({ paused: true }); await advance(600000);
  expect(state.token === 'test-only-token').toBe(true); expect(pending).toHaveLength(1);
});
it('rejects invalid data and redacts unexpected transport details', async () => {
  await render(); await advance(); await respond(0, { quote: { debug: 'private' }, token: 'invalid' });
  expect(state.ready).toBe(false); expect(state.error).not.toContain('INVALID_STORED_QUOTE');
  await act(async () => state.refresh()); await advance(); await act(async () => pending[1].reject(new Error('private database details')));
  expect(state.error).not.toContain('private');
  await act(async () => state.refresh()); await advance(); await act(async () => pending[2].reject(new SettlementClientError('Sign in again to update your saved basket.')));
  expect(state.error).toContain('Sign in again');
});
it('does not quote an empty cart and aborts pending work on unmount', async () => {
  await render({ empty: true }); await advance(); expect(pending).toHaveLength(0); expect(state.loading).toBe(false);
  await render(); await advance(); await act(async () => root.unmount()); root = createRoot(container);
  expect(pending[0].signal.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
});
