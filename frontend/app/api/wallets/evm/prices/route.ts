/**
 * GET /api/wallets/evm/prices?chainId=369&addresses=0x…,0x…
 * USD prices for tokens on one chain from GeckoTerminal (keyless, priced by
 * DEX liquidity), plus the native coin via its wrapped token. Cached per
 * address for a minute so polling clients never hammer the upstream; the
 * session requirement and read rate limit keep it from being a free proxy.
 *
 * @stability experimental
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MyLibUserAuth } from '@/lib/user-auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { GECKO_BATCH, GECKO_NETWORKS, WRAPPED_NATIVE, chunk, normaliseAddresses, parseGeckoPrices } from '@/lib/token-prices';

const querySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  addresses: z.string().max(4000).optional(),
});

const CACHE_TTL = 60_000;
const MAX_ADDRESSES = 90;
const cache = new Map<string, { price: number | null; ts: number }>();

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
  if (!network) return NextResponse.json({ chainId, prices: {}, native: null, source: 'none' }, { headers });

  const wrapped = WRAPPED_NATIVE[chainId]?.toLowerCase();
  const wanted = normaliseAddresses([...(parsed.data.addresses?.split(',') ?? []), ...(wrapped ? [wrapped] : [])]).slice(0, MAX_ADDRESSES);

  const now = Date.now();
  const prices: Record<string, number> = {};
  const missing: string[] = [];
  for (const address of wanted) {
    const hit = cache.get(`${chainId}:${address}`);
    if (hit && now - hit.ts < CACHE_TTL) { if (hit.price) prices[address] = hit.price; }
    else missing.push(address);
  }

  let upstreamFailed = false;
  for (const batch of chunk(missing, GECKO_BATCH)) {
    try {
      const res = await fetch(`https://api.geckoterminal.com/api/v2/simple/networks/${network}/token_price/${batch.join(',')}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
      const found = parseGeckoPrices(await res.json());
      for (const address of batch) {
        const price = found[address] ?? null;
        cache.set(`${chainId}:${address}`, { price, ts: now });
        if (price) prices[address] = price;
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
    native: wrapped ? prices[wrapped] ?? null : null,
    source: 'geckoterminal',
    ...(upstreamFailed ? { partial: true } : {}),
  }, { headers });
}
