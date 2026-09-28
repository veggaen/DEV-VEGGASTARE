/** @fileOverview Server FX tests use controlled network responses; no fallback prices enter settlement. */
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createSettlementFxReader } from './settlement-fx';

const now = Date.parse('2026-09-25T12:00:00Z');
const rows = () => Object.entries({ USD: 0.10519, EUR: 0.09225, GBP: 0.07938, SEK: 1.0415, DKK: 0.68962 })
  .map(([quote, rate]) => ({ base: 'NOK', quote, rate, date: '2026-09-25' }));

describe('server settlement FX', () => {
  it('does not need external FX for NOK, and rejects unknown currencies', async () => {
    const network = vi.fn(); const read = createSettlementFxReader(network, () => now);
    expect(await read('NOK')).toBeNull();
    await expect(read('ETH' as 'USD')).rejects.toThrow('UNSUPPORTED_SETTLEMENT_CURRENCY');
    expect(network).not.toHaveBeenCalled();
  });
  it('reads only the pinned ECB endpoint, caches and returns defensive copies', async () => {
    const network = vi.fn().mockResolvedValue(Response.json(rows()));
    const read = createSettlementFxReader(network, () => now);
    const usd = await read('USD');
    expect(usd).toMatchObject({ currency: 'USD', base: 'NOK', rate: '0.10519', source: 'ECB_VIA_FRANKFURTER' });
    usd!.rate = '99';
    expect((await read('USD'))!.rate).toBe('0.10519');
    expect((await read('EUR'))!.rate).toBe('0.09225');
    expect(network).toHaveBeenCalledTimes(1);
    expect(network.mock.calls[0]).toEqual(['https://api.frankfurter.dev/v2/providers/ecb/rates?base=NOK&quotes=USD,EUR,GBP,SEK,DKK',
      expect.objectContaining({ cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal) })]);
  });
  it('deduplicates concurrent public reads without carrying user data', async () => {
    let finish!: (response: Response) => void;
    const network = vi.fn().mockReturnValue(new Promise<Response>(resolve => { finish = resolve; }));
    const read = createSettlementFxReader(network, () => now);
    const a = read('USD'), b = read('EUR');
    expect(network).toHaveBeenCalledTimes(1);
    finish(Response.json(rows()));
    expect((await a)!.currency).toBe('USD'); expect((await b)!.currency).toBe('EUR');
  });
  it('never falls back to expired cache after a refresh fails, then recovers', async () => {
    let time = now;
    const network = vi.fn().mockResolvedValueOnce(Response.json(rows())).mockRejectedValueOnce(new Error('untrusted provider body'))
      .mockResolvedValueOnce(Response.json(rows()));
    const read = createSettlementFxReader(network, () => time);
    await read('USD'); time += 5 * 60_000;
    await expect(read('USD')).rejects.toThrow('SETTLEMENT_FX_UNAVAILABLE');
    expect((await read('USD'))!.fetchedAt).toBe(new Date(time).toISOString());
    expect(network).toHaveBeenCalledTimes(3);
  });
  it.each([
    () => new Response('bad', { status: 502 }),
    () => new Response('<html>bad</html>', { headers: { 'content-type': 'text/html' } }),
    () => Response.json(rows().slice(1)),
    () => Response.json([rows()[0], rows()[0], ...rows().slice(2)]),
    () => Response.json(rows().map(row => ({ ...row, base: 'USD' }))),
    () => Response.json(rows().map(row => ({ ...row, rate: 0 }))),
    () => Response.json(rows().map(row => ({ ...row, rate: 0.1234567891234 }))),
    () => Response.json(rows().map(row => ({ ...row, rate: '0.1' }))),
    () => Response.json(rows().map(row => ({ ...row, date: '2026-08-25' }))),
    () => Response.json(rows().map(row => ({ ...row, date: '2026-09-26' }))),
    () => Response.json(rows().map((row, i) => ({ ...row, date: i ? row.date : '2026-09-24' }))),
    () => Response.json(rows(), { headers: { 'content-length': '99999' } }),
    () => new Response(' '.repeat(8193), { headers: { 'content-type': 'application/json' } }),
    () => new Response('{bad json}', { headers: { 'content-type': 'application/json' } }),
  ])('fails closed on malformed, oversized or stale upstream response %#', async response => {
    const read = createSettlementFxReader(vi.fn().mockResolvedValue(response()), () => now);
    await expect(read('USD')).rejects.toThrow('SETTLEMENT_FX_UNAVAILABLE');
  });
});
