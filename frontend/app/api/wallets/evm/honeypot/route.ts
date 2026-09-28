/**
 * GET /api/wallets/evm/honeypot?chainId=1&addresses=0x…,0x…
 * Honeypot.is sale simulation for tokens on Ethereum, BSC and Base: can the
 * token actually be sold, at what tax, and what its scanner flags. Second
 * opinion next to GoPlus; cached six hours per address, at most eight fresh
 * lookups per request. Session + read rate limit.
 *
 * @stability experimental
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MyLibUserAuth } from '@/lib/user-auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { normaliseAddresses } from '@/lib/token-prices';
import type { HoneypotVerdict } from '@/lib/token-risk';

const querySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  addresses: z.string().max(2000).optional(),
});

const SUPPORTED = new Set([1, 56, 8453]);
const CACHE_TTL = 6 * 60 * 60_000;
const MAX_FRESH = 8;
const cache = new Map<string, { verdict: HoneypotVerdict | null; ts: number }>();

type Upstream = {
  summary?: { risk?: string; riskLevel?: number; flags?: Array<{ flag?: string; description?: string; severity?: string }> };
  simulationSuccess?: boolean;
  simulationError?: string;
  honeypotResult?: { isHoneypot?: boolean; honeypotReason?: string };
  simulationResult?: { buyTax?: number; sellTax?: number; transferTax?: number };
};

function toVerdict(u: Upstream): HoneypotVerdict {
  return {
    isHoneypot: u.honeypotResult?.isHoneypot,
    simulationFailed: u.simulationSuccess === false,
    reason: u.honeypotResult?.honeypotReason ?? (u.simulationSuccess === false ? u.simulationError?.slice(0, 120) : undefined),
    buyTax: typeof u.simulationResult?.buyTax === 'number' ? u.simulationResult.buyTax : undefined,
    sellTax: typeof u.simulationResult?.sellTax === 'number' ? u.simulationResult.sellTax : undefined,
    risk: u.summary?.risk,
    flags: (u.summary?.flags ?? []).map((f) => ({ flag: f.flag ?? '', description: f.description ?? '', severity: f.severity ?? 'low' })),
  };
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
  if (!SUPPORTED.has(chainId)) return NextResponse.json({ chainId, tokens: {}, source: 'none' }, { headers });

  const wanted = normaliseAddresses(parsed.data.addresses?.split(',') ?? []).slice(0, 40);
  const now = Date.now();
  const tokens: Record<string, HoneypotVerdict> = {};
  const missing: string[] = [];
  for (const address of wanted) {
    const hit = cache.get(`${chainId}:${address}`);
    if (hit && now - hit.ts < CACHE_TTL) { if (hit.verdict) tokens[address] = hit.verdict; }
    else missing.push(address);
  }

  let upstreamFailed = false;
  for (const address of missing.slice(0, MAX_FRESH)) {
    try {
      const res = await fetch(`https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=${chainId}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
      if (res.status === 404 || res.status === 400) { cache.set(`${chainId}:${address}`, { verdict: null, ts: now }); continue; }
      if (!res.ok) throw new Error(`Honeypot.is ${res.status}`);
      const verdict = toVerdict((await res.json()) as Upstream);
      cache.set(`${chainId}:${address}`, { verdict, ts: now });
      tokens[address] = verdict;
    } catch (error) {
      upstreamFailed = true;
      console.warn('[api/wallets/evm/honeypot] upstream unavailable:', error instanceof Error ? error.message : error);
    }
  }
  if (cache.size > 5000) for (const key of Array.from(cache.keys()).slice(0, 1000)) cache.delete(key);

  return NextResponse.json({ chainId, tokens, source: 'honeypot.is', pending: missing.slice(MAX_FRESH), ...(upstreamFailed ? { partial: true } : {}) }, { headers });
}
