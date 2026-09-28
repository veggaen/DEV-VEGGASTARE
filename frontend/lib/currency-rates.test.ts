/** @fileOverview Provider omissions must not become invented fresh display quotes. @stability stable */
import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
it('does not fill missing crypto prices with hardcoded prices', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ethereum: { usd: 2400 }, bitcoin: { usd: -1 }, solana: { usd: '200' } }) }));
  const rates = await import('./currency-rates');
  expect(await rates.getCryptoPrices()).toEqual({ ETH: 2400 });
  expect(rates.getCryptoPricesTimestamp()).not.toBeNull();
});
it('invalid fiat data is not stamped as a successful provider refresh', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { NOK: 0, EUR: '1', GBP: Infinity } }) }));
  const rates = await import('./currency-rates'); await rates.getExchangeRates();
  expect(rates.getRatesTimestamp()).toBeNull(); expect(rates.areRatesFresh()).toBe(false);
});
