/** @fileOverview Same-origin, authenticated and rate-limited wallet mutations. @stability evolving */
import { NextRequest, NextResponse } from 'next/server';
import { MyLibUserAuth } from '@/lib/user-auth';
import { isDemoUserId } from '@/lib/demo-policy';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { WalletLinkError } from '@/lib/wallet-link';

export function walletLinkResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function walletLinkRequest(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (req.headers.get('origin') !== origin) return walletLinkResponse({ error: 'Open wallet settings on this site and try again.' }, 403);
  const session = await MyLibUserAuth();
  if (!session?.id) return walletLinkResponse({ error: 'Sign in to link your wallet.' }, 401);
  if (isDemoUserId(session.id)) return walletLinkResponse({ error: 'Wallet linking is unavailable in the demo.' }, 403);
  for (const key of [getClientIdentifier(req), `wallet-user:${session.id}`]) {
    const limit = await checkRateLimit(key, 'wallet');
    if (!limit.success) {
      const response = rateLimitedResponse(limit); response.headers.set('Cache-Control', 'private, no-store'); return response;
    }
  }
  return { userId: session.id, origin };
}
export function walletLinkFailure(error: unknown) {
  if (error instanceof WalletLinkError) return walletLinkResponse({ error: error.message }, error.status);
  console.error('[wallet-link] Request could not be completed');
  return walletLinkResponse({ error: 'Wallet verification is unavailable. Please try again.' }, 503);
}
