/**
 * @fileOverview GET /api/auth/confirm-oauth-link
 * @stability stable
 *
 * Called when the user clicks the confirmation button in the OAuth-link email.
 * - Validates the token from PendingOAuthLink
 * - Sets the corresponding hasXxxAuth flag on the User
 * - Runs verification tier recalculation
 * - Deletes the pending record
 * - On deny=1: removes the Account entry that NextAuth created + deletes pending record
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { recalculateVerificationTier } from '@/lib/verification-recalc';

const PROVIDER_FLAG: Record<string, string> = {
  google:  'hasGoogleAuth',
  github:  'hasGithubAuth',
  discord: 'hasDiscordAuth',
};

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const deny  = req.nextUrl.searchParams.get('deny') === '1';

  if (!token) {
    return NextResponse.redirect(
      new URL('/settings?section=verification&oauthConfirm=invalid', req.url)
    );
  }

  const pending = await dbPrisma.pendingOAuthLink.findUnique({ where: { token } });

  if (!pending) {
    return NextResponse.redirect(
      new URL('/settings?section=verification&oauthConfirm=expired', req.url)
    );
  }

  if (pending.expires < new Date()) {
    await dbPrisma.pendingOAuthLink.delete({ where: { token } });
    return NextResponse.redirect(
      new URL('/settings?section=verification&oauthConfirm=expired', req.url)
    );
  }

  // Always remove the pending record
  await dbPrisma.pendingOAuthLink.delete({ where: { token } });

  if (deny) {
    // Remove the OAuth Account entry NextAuth created, so they can't sign in with it
    await dbPrisma.account.deleteMany({
      where: { userId: pending.userId, provider: pending.provider },
    });
    return NextResponse.redirect(
      new URL('/settings?section=verification&oauthConfirm=denied', req.url)
    );
  }

  // Confirm: set the flag and recalculate
  const flagKey = PROVIDER_FLAG[pending.provider];
  if (flagKey) {
    await dbPrisma.user.update({
      where: { id: pending.userId },
      data: { [flagKey]: true },
    });
    await recalculateVerificationTier(pending.userId, { [flagKey]: true });
  }

  return NextResponse.redirect(
    new URL(`/settings?section=verification&oauthConfirm=${encodeURIComponent(pending.provider)}`, req.url)
  );
}
