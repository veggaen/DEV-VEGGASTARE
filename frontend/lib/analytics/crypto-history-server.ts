/** @fileOverview Shared validated hourly history cache; secrets stay in provider headers. @stability stable */
import { unstable_cache } from 'next/cache';
import { normalizeProviderPrices, type HistoryCoin, type HistoryCurrency } from './crypto-history';

export async function fetchProviderHistory(coin: HistoryCoin, currency: HistoryCurrency) {
  const proKey = process.env.COINGECKO_API_KEY;
  const demoKey = process.env.COINGECKO_DEMO_API_KEY;
  const host = proKey ? 'https://pro-api.coingecko.com' : 'https://api.coingecko.com';
  const url = new URL('/api/v3/coins/' + coin + '/market_chart', host);
  url.search = new URLSearchParams({ vs_currency: currency, days: '365', interval: 'daily' }).toString();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (proKey) headers['x-cg-pro-api-key'] = proKey;
  else if (demoKey) headers['x-cg-demo-api-key'] = demoKey;
  const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Market data provider unavailable');
  return { coin, currency, fetchedAt: new Date().toISOString(), data: normalizeProviderPrices(await response.json()) };
}

// Exactly nine allowlisted coin/currency pairs; user date filters do not create
// more upstream cache keys. Cache only validated successful responses.
export const getCryptoHistory = unstable_cache(fetchProviderHistory, ['veggat-daily-price-history-v1'], { revalidate: 3600 });
