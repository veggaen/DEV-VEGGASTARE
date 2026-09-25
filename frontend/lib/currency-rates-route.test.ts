/** @fileOverview Market-rate requests must not block prerendering. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ connection: vi.fn(), fiat: vi.fn(), crypto: vi.fn() }));
vi.mock('next/server', async original => ({ ...await original<typeof import('next/server')>(), connection: m.connection }));
vi.mock('@/lib/currency-rates', () => ({ getExchangeRates: m.fiat, getCryptoPrices: m.crypto,
  areRatesFresh: () => true, areCryptoPricesFresh: () => false, getRatesTimestamp: () => 1_700_000_000_000, getCryptoPricesTimestamp: () => null,
}));
import { GET } from '@/app/api/currency-rates/route';
beforeEach(() => { vi.resetAllMocks(); m.fiat.mockResolvedValue({ USD: 1 }); m.crypto.mockResolvedValue({ ETH: 1000 }); });
it('waits for a real request before touching either rate provider and retains freshness evidence', async () => {
  let release!: () => void; m.connection.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
  const pending = GET(); expect(m.fiat).not.toHaveBeenCalled(); expect(m.crypto).not.toHaveBeenCalled();
  release(); const response = await pending; expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ fiat: { fresh: true, timestamp: 1_700_000_000_000 }, crypto: { fresh: false, timestamp: null }, rates: { USD: 1 } });
});
it('does not swallow the prerender boundary or call providers during static generation', async () => {
  const boundary = new Error('prerender boundary'); m.connection.mockRejectedValue(boundary);
  await expect(GET()).rejects.toBe(boundary); expect(m.fiat).not.toHaveBeenCalled(); expect(m.crypto).not.toHaveBeenCalled();
});
