/**
 * GET /api/wallets/evm/prices?chainId=369&addresses=0x…,0x…
 * USD prices for tokens on one chain from GeckoTerminal (keyless, priced by
 * DEX liquidity), plus the native coin via its wrapped token, plus each
 * token's DEX reserve and 24 h volume so the client can judge whether that
 * price is real. Cached per address for a minute so polling clients never
 * hammer the upstream; the session requirement and read rate limit keep it
 * from being a free proxy.
 *
 * @stability experimental
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MyLibUserAuth } from '@/lib/user-auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { GECKO_BATCH, GECKO_NETWORKS, WRAPPED_NATIVE, chunk, normaliseAddresses, parseGeckoSimple } from '@/lib/token-prices';

const querySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  addresses: z.string().max(4000).optional(),
});

const CACHE_TTL = 60_000;
const MAX_ADDRESSES = 90;
type Entry = { price: number | null; reserve: number | null; volume: number | null; ts: number };
const cache = new Map<string, Entry>();

export async function GET(request: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await checkRateLimit(getClientIdentifier(request, session.id), 'read');
  if (!limit.success) return rateLimitedResponse(limit);

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { chainId } = parsed.data;
  const network = GECKO_NETWORKS[chainId];
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!network) return NextResponse.json({ chainId, prices: {}, liquidity: {}, volume24h: {}, native: null, source: 'none' }, { headers });

  const wrapped = WRAPPED_NATIVE[chainId]?.toLowerCase();
  const wanted = normaliseAddresses([...(parsed.data.addresses?.split(',') ?? []), ...(wrapped ? [wrapped] : [])]).slice(0, MAX_ADDRESSES);

  const now = Date.now();
  const prices: Record<string, number> = {};
  const liquidity: Record<string, number> = {};
  const volume24h: Record<string, number> = {};
  const publish = (address: string, e: Entry) => {
    if (e.price) prices[address] = e.price;
    if (e.reserve !== null) liquidity[address] = e.reserve;
    if (e.volume !== null) volume24h[address] = e.volume;
  };
  const missing: string[] = [];
  for (const address of wanted) {
    const hit = cache.get(`${chainId}:${address}`);
    if (hit && now - hit.ts < CACHE_TTL) publish(address, hit);
    else missing.push(address);
  }

  let upstreamFailed = false;
  for (const batch of chunk(missing, GECKO_BATCH)) {
    try {
      const res = await fetch(`https://api.geckoterminal.com/api/v2/simple/networks/${network}/token_price/${batch.join(',')}?include_total_reserve_in_usd=true&include_24hr_vol=true`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
      const found = parseGeckoSimple(await res.json());
      for (const address of batch) {
        const entry: Entry = { price: found.prices[address] ?? null, reserve: found.reserves[address] ?? null, volume: found.volumes[address] ?? null, ts: now };
        cache.set(`${chainId}:${address}`, entry);
        publish(address, entry);
      }
    } catch (error) {
      upstreamFailed = true;
      console.warn('[api/wallets/evm/prices] upstream unavailable:', error instanceof Error ? error.message : error);
    }
  }
  if (cache.size > 5000) for (const key of Array.from(cache.keys()).slice(0, 1000)) cache.delete(key);

  return NextResponse.json({
    chainId,
    prices,
    liquidity,
    volume24h,
    native: wrapped ? prices[wrapped] ?? null : null,
    source: 'geckoterminal',
    ...(upstreamFailed ? { partial: true } : {}),
  }, { headers });
}
