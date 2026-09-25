/** @fileOverview Bounded fresh ECB reference FX for server settlement quotes; no stale/display fallback. @stability experimental */
import 'server-only';
import { z } from 'zod';
import { SettlementCurrency, SettlementError } from './settlement-money';
import { type SettlementFx, validateSettlementFx } from './settlement-quote';

const FX_URL = 'https://api.frankfurter.dev/v2/providers/ecb/rates?base=NOK&quotes=USD,EUR,GBP,SEK,DKK';
const Row = z.object({ base: z.literal('NOK'), quote: SettlementCurrency, date: z.string().date(),
  rate: z.number().finite().min(0.001).max(100) });
const Rows = z.array(Row).length(5);
const CACHE_MS = 5 * 60_000;
const MAX_BYTES = 8_192;

export function createSettlementFxReader(network: typeof fetch = fetch, clock: () => number = Date.now) {
  let cached: { fetchedAt: number; rates: Map<SettlementCurrency, SettlementFx> } | null = null;
  let pending: Promise<Map<SettlementCurrency, SettlementFx>> | null = null;
  async function load(): Promise<Map<SettlementCurrency, SettlementFx>> {
    try {
      const response = await network(FX_URL, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5_000) });
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('application/json')) throw new Error();
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > MAX_BYTES) throw new Error();
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const result = await reader.read();
          if (result.done) break;
          size += result.value.byteLength;
          if (size > MAX_BYTES) throw new Error();
          chunks.push(result.value);
        }
      } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const rows = Rows.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
      const now = clock(), rates = new Map<SettlementCurrency, SettlementFx>();
      for (const row of rows) {
        if (row.quote === 'NOK' || rates.has(row.quote)) throw new Error();
        // Preserve the provider decimal, never silently round an unexpectedly
        // precise/non-decimal representation into a different settlement rate.
        const fx = validateSettlementFx({ source: 'ECB_VIA_FRANKFURTER', base: 'NOK', currency: row.quote,
          rate: String(row.rate), publishedOn: row.date, fetchedAt: new Date(now).toISOString() }, row.quote, now);
        rates.set(row.quote, fx);
      }
      if (new Set(rows.map(row => row.date)).size !== 1) throw new Error();
      cached = { fetchedAt: now, rates };
      return rates;
    } catch { throw new SettlementError('SETTLEMENT_FX_UNAVAILABLE'); }
  }
  return async function readSettlementFx(currency: SettlementCurrency): Promise<SettlementFx | null> {
    if (!SettlementCurrency.safeParse(currency).success) throw new SettlementError('UNSUPPORTED_SETTLEMENT_CURRENCY');
    if (currency === 'NOK') return null;
    const now = clock();
    if (cached && now >= cached.fetchedAt && now - cached.fetchedAt < CACHE_MS) {
      return validateSettlementFx(cached.rates.get(currency), currency, now);
    }
    // Concurrent quote requests share one public rates read, not one another's
    // user data. An unavailable upstream never resurrects expired cached prices.
    if (!pending) pending = load().finally(() => { pending = null; });
    return validateSettlementFx((await pending).get(currency), currency, clock());
  };
}

export const readSettlementFx = createSettlementFxReader();
