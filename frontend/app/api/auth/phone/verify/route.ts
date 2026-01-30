/**
 * Phone Verification - Verify Code Route
 * 
 * POST /api/auth/phone/verify - Verify code and update user
 */

import { NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { verifyCodeHash } from '@/lib/phone-verification';
import { calculateVerificationScore, determineUserVerificationTier } from '@/lib/view-strength';

const LOG_PREFIX = '[api/auth/phone/verify]';
const MAX_ATTEMPTS = 3;

/**
 * POST /api/auth/phone/verify
 * 
 * Verify a phone verification code and update user's verification status.
 */
export async function POST(req: Request) {
  const session = await MyLibUserAuth();
  
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ 
        error: 'Invalid code',
        message: 'Please enter a 6-digit verification code',
      }, { status: 400 });
    }

    // Get pending verification
    const verification = await dbPrisma.phoneVerification.findFirst({
      where: {
        userId: session.id,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      return NextResponse.json({ 
        error: 'No pending verification',
        message: 'Please request a new verification code',
      }, { status: 400 });
    }

    // Check attempts
    if (verification.attempts >= MAX_ATTEMPTS) {
      await dbPrisma.phoneVerification.update({
        where: { id: verification.id },
        data: { status: 'BLOCKED' },
      });
      
      return NextResponse.json({
        error: 'Too many attempts',
        message: 'Maximum attempts exceeded. Please request a new code.',
      }, { status: 429 });
    }

    // Verify code
    const isValid = verifyCodeHash(code, verification.code!);

    if (!isValid) {
      // Increment attempts
      await dbPrisma.phoneVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });

      const attemptsRemaining = MAX_ATTEMPTS - verification.attempts - 1;
      
      return NextResponse.json({
        error: 'Invalid code',
        message: attemptsRemaining > 0 
          ? `Incorrect code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect code. No attempts remaining.',
        attemptsRemaining,
      }, { status: 400 });
    }

    // Code is valid - update verification and user
    const now = new Date();

    await dbPrisma.$transaction(async (tx) => {
      // Mark verification as verified
      await tx.phoneVerification.update({
        where: { id: verification.id },
        data: {
          status: 'VERIFIED',
          verifiedAt: now,
        },
      });

      // Get current user data for tier calculation
      const currentUser = await tx.user.findUnique({
        where: { id: session.id },
        select: {
          hasGoogleAuth: true,
          hasDiscordAuth: true,
          hasGithubAuth: true,
          hasVerifiedWallet: true,
          hasWeb2Payment: true,
          hasWeb3Payment: true,
          emailVerified: true,
          isTwoFactorEnabled: true,
        },
      });

      // Calculate new verification tier and score
      const updatedUserData = {
        ...currentUser,
        phoneVerified: now,
      };
      
      const newTier = determineUserVerificationTier(updatedUserData);
      const newScore = calculateVerificationScore(updatedUserData);

      // Update user
      await tx.user.update({
        where: { id: session.id },
        data: {
          phoneNumber: verification.phoneNumber,
          phoneVerified: now,
          phoneCountryCode: verification.countryCode,
          verificationTier: newTier,
          verificationScore: newScore,
        },
      });
    });

    console.log(LOG_PREFIX, `Phone verified for user ${session.id}: ${verification.phoneNumber.slice(0, -4)}****`);

    // Get updated user data
    const updatedUser = await dbPrisma.user.findUnique({
      where: { id: session.id },
      select: {
        phoneVerified: true,
        verificationTier: true,
        verificationScore: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully',
      phoneVerified: true,
      verificationTier: updatedUser?.verificationTier,
      verificationScore: updatedUser?.verificationScore,
    });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error verifying code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
