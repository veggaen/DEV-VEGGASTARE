/**
 * GET /api/wallets/evm/price-history?chainId=1&address=0x…&days=90
 * Daily USD closes for any token with a DEX pool, from GeckoTerminal: the
 * token's most liquid pool, then that pool's daily OHLCV. Cached an hour per
 * token. Chains without a GeckoTerminal network answer with an empty series.
 *
 * @stability experimental
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MyLibUserAuth } from '@/lib/user-auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { GECKO_NETWORKS, WRAPPED_NATIVE } from '@/lib/token-prices';

const querySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  address: z.string().regex(/^(0x[a-fA-F0-9]{40}|native)$/),
  days: z.coerce.number().int().min(2).max(365).default(90),
});

const CACHE_TTL = 60 * 60_000;
type Point = { t: number; p: number };
const cache = new Map<string, { points: Point[]; ts: number }>();

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function GET(request: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await checkRateLimit(getClientIdentifier(request, session.id), 'read');
  if (!limit.success) return rateLimitedResponse(limit);

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { chainId, days } = parsed.data;
  const headers = { 'Cache-Control': 'private, no-store' };
  const network = GECKO_NETWORKS[chainId];
  const address = (parsed.data.address === 'native' ? WRAPPED_NATIVE[chainId] : parsed.data.address)?.toLowerCase();
  if (!network || !address) return NextResponse.json({ chainId, address: parsed.data.address, points: [], source: 'none' }, { headers });

  const key = `${chainId}:${address}:${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return NextResponse.json({ chainId, address, points: hit.points, source: 'geckoterminal' }, { headers });

  try {
    const pools = await getJson<{ data?: Array<{ id: string; attributes?: { reserve_in_usd?: string }; relationships?: { base_token?: { data?: { id?: string } } } }> }>(`https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${address}/pools?page=1`);
    const best = (pools?.data ?? []).slice().sort((a, b) => Number(b.attributes?.reserve_in_usd ?? 0) - Number(a.attributes?.reserve_in_usd ?? 0))[0];
    if (!best) { cache.set(key, { points: [], ts: Date.now() }); return NextResponse.json({ chainId, address, points: [], source: 'geckoterminal' }, { headers }); }
    const poolAddress = best.id.includes('_') ? best.id.slice(best.id.indexOf('_') + 1) : best.id;
    const baseId = best.relationships?.base_token?.data?.id ?? '';
    const side = baseId.toLowerCase().endsWith(address) ? 'base' : 'quote';
    const ohlcv = await getJson<{ data?: { attributes?: { ohlcv_list?: Array<[number, number, number, number, number, number]> } } }>(`https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/ohlcv/day?limit=${days}&currency=usd&token=${side}`);
    const points: Point[] = (ohlcv?.data?.attributes?.ohlcv_list ?? [])
      .map(([ts, , , , close]) => ({ t: ts * 1000, p: Number(close) }))
      .filter((p) => Number.isFinite(p.p) && p.p > 0)
      .sort((a, b) => a.t - b.t);
    cache.set(key, { points, ts: Date.now() });
    if (cache.size > 2000) for (const k of Array.from(cache.keys()).slice(0, 500)) cache.delete(k);
    return NextResponse.json({ chainId, address, points, source: 'geckoterminal', pool: poolAddress }, { headers });
  } catch (error) {
    console.warn('[api/wallets/evm/price-history] upstream unavailable:', error instanceof Error ? error.message : error);
    return NextResponse.json({ chainId, address, points: [], source: 'geckoterminal', partial: true }, { headers });
  }
}
