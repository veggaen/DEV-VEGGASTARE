/** @fileOverview Local probes validate chain identity and cancel cleanly. @stability stable */
import { afterEach, expect, it, vi } from 'vitest';
import { readLocalChainStatus } from './local-chain-status';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const signal = () => new AbortController().signal;
it.each([
  [{ result: '0x7a69' }, 'online'], [{ result: '0x1' }, 'offline'],
  [{ result: true }, 'offline'], [{ error: { message: 'no method' } }, 'offline'],
  [{ result: 'not a chain' }, 'offline'],
])('validates the expected chain response %#', async (body, status) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));
  expect(await readLocalChainStatus(31337, 'http://127.0.0.1:8545', signal())).toBe(status);
});
it('handles HTTP, invalid JSON and network errors without throwing', async () => {
  const request = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(new Response('invalid')).mockRejectedValueOnce(new Error('offline'));
  vi.stubGlobal('fetch', request);
  for (let i = 0; i < 3; i++) expect(await readLocalChainStatus(31337, 'http://127.0.0.1:8545', signal())).toBe('offline');
});
it('clears the timeout after a failed fetch', async () => {
  vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  await readLocalChainStatus(31337, 'http://127.0.0.1:8545', signal()); expect(vi.getTimerCount()).toBe(0);
});
it('aborts after two seconds and on unmount/cancel', async () => {
  vi.useFakeTimers();
  const aborts = vi.fn();
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => { aborts(); reject(new Error('aborted')); }))));
  const timed = readLocalChainStatus(31337, 'http://127.0.0.1:8545', signal());
  await vi.advanceTimersByTimeAsync(2000); expect(await timed).toBe('offline');
  const controller = new AbortController();
  const cancelled = readLocalChainStatus(1337, 'http://127.0.0.1:7545', controller.signal);
  controller.abort(); expect(await cancelled).toBe('offline');
  expect(aborts).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
});
it('does not start an already cancelled request', async () => {
  const request = vi.fn(); vi.stubGlobal('fetch', request);
  const controller = new AbortController(); controller.abort();
  expect(await readLocalChainStatus(1337, 'http://127.0.0.1:7545', controller.signal)).toBe('offline');
  expect(request).not.toHaveBeenCalled();
});
