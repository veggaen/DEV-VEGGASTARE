/** @fileOverview Checkout diagnostics redact sensitive error content and retain origin/auth guards. @stability stable */
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: vi.fn() }));
import { checkoutErrorResponse, checkoutUser } from './checkout-request';
import { CheckoutError } from './showcase-policy';
afterEach(() => vi.restoreAllMocks());

it('logs only an allowlisted database code, not error messages or metadata', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const response = checkoutErrorResponse(Object.assign(new Error('secret credentials and SQL'), { code: 'P2028', meta: 'private' }));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'CHECKOUT_TEMPORARILY_UNAVAILABLE' });
  expect(log).toHaveBeenCalledWith('[checkout] Request denied or unavailable:', 'P2028');
});
it('does not echo arbitrary error codes', () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  checkoutErrorResponse({ code: 'private-provider-response', message: 'secret' });
  expect(log).toHaveBeenCalledWith('[checkout] Request denied or unavailable:', 'UNEXPECTED');
});
it('preserves known checkout denial status and code', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const response = checkoutErrorResponse(new CheckoutError('CART_CHANGED', 409));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'CART_CHANGED' });
});
it('rejects a mismatched or absent Origin before checking a session', async () => {
  await expect(checkoutUser(new Request('http://localhost:3000/api/checkout', {
    method: 'POST', headers: { Origin: 'http://localhost:3100' },
  }))).rejects.toThrow('INVALID_ORIGIN');
  await expect(checkoutUser(new Request('http://localhost:3000/api/checkout', { method: 'POST' }))).rejects.toThrow('INVALID_ORIGIN');
});
