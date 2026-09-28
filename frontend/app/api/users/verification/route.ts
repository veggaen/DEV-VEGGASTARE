/** @fileOverview Authenticated, current verification evidence; guarded cache refresh. @stability stable */
import { NextRequest, NextResponse } from 'next/server';
import { MyLibUserAuth } from '@/lib/user-auth';
import { VERIFICATION_TIER_MULTIPLIERS, type VerificationTier } from '@/lib/view-strength';
import { recalculateVerificationTier } from '@/lib/verification-recalc';
import { readVerificationEvidence } from '@/lib/verification-evidence';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { isDemoUserId } from '@/lib/demo-policy';

const headers = { 'Cache-Control': 'private, no-store' };
export async function GET() {
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  try {
    const evidence = await readVerificationEvidence(session.id);
    if (!evidence) return NextResponse.json({ error: 'User not found' }, { status: 404, headers });
    const { flags, tier, score, multiplier, linkedProviders, pendingProviders, user } = evidence;
    return NextResponse.json({ flags, tier, score, multiplier, linkedProviders, pendingProviders,
      phoneNumber: user.phoneNumber ? user.phoneNumber.slice(0, -4) + '****' : null }, { headers });
  } catch {
    return NextResponse.json({ error: 'Verification is temporarily unavailable. Please retry.' }, { status: 503, headers });
  }
}

/** Compatibility endpoint. The settings Refresh button only needs GET now. */
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers });
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (isDemoUserId(session.id)) return NextResponse.json({ error: 'Demo accounts cannot change verification.' }, { status: 403, headers });
  if (!await allowAuthAttempt('verification-refresh', session.id, req)) return NextResponse.json({ error: 'Try again in a few minutes.' }, { status: 429, headers });
  const result = await recalculateVerificationTier(session.id);
  if (!result) return NextResponse.json({ error: 'Verification is temporarily unavailable.' }, { status: 503, headers });
  return NextResponse.json({ success: true, ...result, multiplier: VERIFICATION_TIER_MULTIPLIERS[result.tier as VerificationTier] }, { headers });
}
