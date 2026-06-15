/**
 * @fileOverview POST /api/auth/unlink-oauth
 * @stability stable
 *
 * Unlinks a social OAuth provider (Google, GitHub, Discord) from the user's account.
 * - Removes the Account record from the DB
 * - Resets the corresponding hasXxxAuth flag
 * - Recalculates the verification tier
 * - Deletes any pending link records for this provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { recalculateVerificationTier } from '@/lib/verification-recalc';

const PROVIDER_FLAG: Record<string, string> = {
  google:  'hasGoogleAuth',
  github:  'hasGithubAuth',
  discord: 'hasDiscordAuth',
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { provider?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const provider = body.provider;
  if (!provider || !PROVIDER_FLAG[provider]) {
    return NextResponse.json({ error: 'Invalid provider. Must be google, github, or discord.' }, { status: 400 });
  }

  const userId = session.user.id;
  const flagKey = PROVIDER_FLAG[provider];

  try {
    // Remove the OAuth Account record
    await dbPrisma.account.deleteMany({
      where: { userId, provider },
    });

    // Reset the verification flag
    await dbPrisma.user.update({
      where: { id: userId },
      data: { [flagKey]: false },
    });

    // Delete any pending link records
    await dbPrisma.pendingOAuthLink.deleteMany({
      where: { userId, provider: provider as 'google' | 'github' | 'discord' },
    });

    // Recalculate verification tier
    await recalculateVerificationTier(userId, { [flagKey]: false });

    return NextResponse.json({ success: true, provider });
  } catch (err) {
    console.error(`[unlink-oauth] Failed to unlink ${provider} for ${userId}:`, err);
    return NextResponse.json({ error: 'Failed to unlink provider' }, { status: 500 });
  }
}
