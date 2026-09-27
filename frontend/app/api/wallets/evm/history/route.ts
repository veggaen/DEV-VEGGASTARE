/**
 * GET /api/wallets/evm/history?chainId=1&address=0x…
 * A wallet's on-chain history from the chain's Blockscout instance: the
 * latest transactions and ERC-20 transfers, folded into one event list the
 * way an explorer shows it. 30 s server cache per wallet; session + read
 * rate limit. Chains without a Blockscout host answer with an empty list.
 *
 * @stability experimental
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MyLibUserAuth } from '@/lib/user-auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { BLOCKSCOUT_HOSTS } from '@/lib/wallet-tokens';
import { mergeChainHistory, type BsTokenTransfer, type BsTransaction, type ChainEvent } from '@/lib/onchain-history';

const querySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const CACHE_TTL = 30_000;
const cache = new Map<string, { events: ChainEvent[]; partial: boolean; ts: number }>();

async function getItems<T>(url: string): Promise<{ items: T[]; ok: boolean }> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    if (res.status === 404) return { items: [], ok: true };
    if (!res.ok) throw new Error(`Blockscout ${res.status}`);
    const body = (await res.json()) as { items?: T[] };
    return { items: Array.isArray(body.items) ? body.items : [], ok: true };
  } catch (error) {
    console.warn('[api/wallets/evm/history] upstream unavailable:', error instanceof Error ? error.message : error);
    return { items: [], ok: false };
  }
}

export async function GET(request: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await checkRateLimit(getClientIdentifier(request, session.id), 'read');
  if (!limit.success) return rateLimitedResponse(limit);

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { chainId, address } = parsed.data;
  const headers = { 'Cache-Control': 'private, no-store' };
  const host = BLOCKSCOUT_HOSTS[chainId];
  if (!host) return NextResponse.json({ chainId, address, events: [], source: 'none' }, { headers });

  const key = `${chainId}:${address.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return NextResponse.json({ chainId, address, events: hit.events, source: 'blockscout', ...(hit.partial ? { partial: true } : {}) }, { headers });

  const [txs, transfers] = await Promise.all([
    getItems<BsTransaction>(`${host}/api/v2/addresses/${address}/transactions`),
    getItems<BsTokenTransfer>(`${host}/api/v2/addresses/${address}/token-transfers?type=ERC-20`),
  ]);
  const events = mergeChainHistory(chainId, address, txs.items, transfers.items, 100);
  const partial = !txs.ok || !transfers.ok;
  if (!partial) cache.set(key, { events, partial, ts: Date.now() });
  if (cache.size > 2000) for (const k of Array.from(cache.keys()).slice(0, 500)) cache.delete(k);

  return NextResponse.json({ chainId, address, events, source: 'blockscout', ...(partial ? { partial: true } : {}) }, { headers });
}
