/**
 * GET /api/wallets/evm/security?chainId=1&addresses=0x…,0x…
 * Contract-level red flags from GoPlus Token Security (keyless): honeypot,
 * taxes, pausable/blacklist/mint powers, DEX liquidity. Cached per address for
 * 15 minutes; chains GoPlus does not cover answer with an empty table so the
 * client falls back to liquidity data alone. Session + read rate limit.
 *
 * @stability experimental
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MyLibUserAuth } from '@/lib/user-auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { chunk, normaliseAddresses } from '@/lib/token-prices';
import type { GoPlusSecurity } from '@/lib/token-risk';

const querySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  addresses: z.string().max(6000).optional(),
});

/** Chains GoPlus answers for (their `supported_chains`; PulseChain is not among them). */
const GOPLUS_CHAINS = new Set([1, 56, 137, 42161, 10, 8453, 43114, 250, 25, 100, 324, 59144, 534352, 5000, 130, 204]);
const CACHE_TTL = 15 * 60_000;
const MAX_ADDRESSES = 120;
const BATCH = 60;
const KEEP: (keyof GoPlusSecurity)[] = [
  'is_honeypot', 'honeypot_with_same_creator', 'is_airdrop_scam', 'fake_token', 'cannot_sell_all', 'cannot_buy', 'transfer_pausable',
  'is_blacklisted', 'is_whitelisted', 'owner_change_balance', 'hidden_owner', 'selfdestruct', 'external_call', 'is_mintable',
  'is_open_source', 'is_proxy', 'is_in_dex', 'trust_list', 'buy_tax', 'sell_tax', 'holder_count', 'dex',
];
const cache = new Map<string, { entry: GoPlusSecurity | null; ts: number }>();

function pick(raw: Record<string, unknown>): GoPlusSecurity {
  const out: Record<string, unknown> = {};
  for (const key of KEEP) {
    const v = raw[key];
    if (key === 'dex') { if (Array.isArray(v)) out.dex = v.map((d) => ({ liquidity: String((d as { liquidity?: unknown })?.liquidity ?? '0') })); }
    else if (typeof v === 'string') out[key] = v;
  }
  return out as GoPlusSecurity;
}

export async function GET(request: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await checkRateLimit(getClientIdentifier(request, session.id), 'read');
  if (!limit.success) return rateLimitedResponse(limit);

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { chainId } = parsed.data;
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!GOPLUS_CHAINS.has(chainId)) return NextResponse.json({ chainId, tokens: {}, source: 'none' }, { headers });

  const wanted = normaliseAddresses(parsed.data.addresses?.split(',') ?? []).slice(0, MAX_ADDRESSES);
  const now = Date.now();
  const tokens: Record<string, GoPlusSecurity> = {};
  const missing: string[] = [];
  for (const address of wanted) {
    const hit = cache.get(`${chainId}:${address}`);
    if (hit && now - hit.ts < CACHE_TTL) { if (hit.entry) tokens[address] = hit.entry; }
    else missing.push(address);
  }

  let upstreamFailed = false;
  for (const batch of chunk(missing, BATCH)) {
    try {
      const res = await fetch(`https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${batch.join(',')}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`GoPlus ${res.status}`);
      const body = (await res.json()) as { code?: number; result?: Record<string, Record<string, unknown>> | null };
      if (body.code !== 1) throw new Error(`GoPlus code ${body.code}`);
      const result = body.result ?? {};
      for (const address of batch) {
        const raw = result[address];
        const entry = raw && typeof raw === 'object' && Object.keys(raw).length ? pick(raw) : null;
        cache.set(`${chainId}:${address}`, { entry, ts: now });
        if (entry) tokens[address] = entry;
      }
    } catch (error) {
      upstreamFailed = true;
      console.warn('[api/wallets/evm/security] upstream unavailable:', error instanceof Error ? error.message : error);
    }
  }
  if (cache.size > 5000) for (const key of Array.from(cache.keys()).slice(0, 1000)) cache.delete(key);

  return NextResponse.json({ chainId, tokens, source: 'goplus', ...(upstreamFailed ? { partial: true } : {}) }, { headers });
}
