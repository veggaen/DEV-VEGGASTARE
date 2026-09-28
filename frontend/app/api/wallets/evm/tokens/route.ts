/**
 * GET /api/wallets/evm/tokens?chainId=1&address=0x…
 * Which ERC-20s an address actually holds, from Blockscout's keyless address
 * API, normalised and capped. Balances are public chain data; the session
 * requirement and rate limit only keep the proxy from being used as a free
 * indexer by others. Cached briefly per address so polling stays polite.
 *
 * @stability experimental
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MyLibUserAuth } from '@/lib/user-auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { BLOCKSCOUT_HOSTS, fromBlockscout, type DiscoveredToken } from '@/lib/wallet-tokens';

const querySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address'),
});

const CACHE_TTL = 30_000;
const cache = new Map<string, { tokens: DiscoveredToken[]; ts: number }>();

export async function GET(request: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await checkRateLimit(getClientIdentifier(request, session.id), 'read');
  if (!limit.success) return rateLimitedResponse(limit);

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { chainId, address } = parsed.data;

  const host = BLOCKSCOUT_HOSTS[chainId];
  if (!host) return NextResponse.json({ chainId, tokens: [], source: 'none' }, { headers: { 'Cache-Control': 'private, no-store' } });

  const key = `${chainId}:${address.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return NextResponse.json({ chainId, tokens: hit.tokens, source: 'blockscout', cached: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  try {
    // The paginated `tokens` endpoint returns the top 50 by fiat value in a
    // few KB; `token-balances` returns every airdrop unpaginated (3 MB and
    // 15 s for a whale wallet).
    const res = await fetch(`${host}/api/v2/addresses/${address}/tokens?type=ERC-20`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    // A brand-new address is a 404 on Blockscout: an empty inventory, not an error.
    if (res.status === 404) {
      cache.set(key, { tokens: [], ts: Date.now() });
      return NextResponse.json({ chainId, tokens: [], source: 'blockscout' }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (!res.ok) throw new Error(`Blockscout ${res.status}`);
    const json = (await res.json()) as { items?: unknown };
    const tokens = fromBlockscout(json.items);
    cache.set(key, { tokens, ts: Date.now() });
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ chainId, tokens, source: 'blockscout' }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.warn('[api/wallets/evm/tokens] indexer unavailable:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Token indexer unavailable' }, { status: 502 });
  }
}
