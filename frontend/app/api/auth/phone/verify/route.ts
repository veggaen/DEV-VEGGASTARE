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
import { PhoneVerifyResponseSchema } from '@/lib/types/phone-verification';
import { z } from 'zod';

const PhoneVerifyBodySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
});

const LOG_PREFIX = '[api/auth/phone/verify]';
const MAX_ATTEMPTS = 3;

function respond(status: number, dto: unknown) {
  const parsed = PhoneVerifyResponseSchema.safeParse(dto);
  if (!parsed.success) {
    console.error(LOG_PREFIX, 'Invalid response DTO:', parsed.error.issues);
    return NextResponse.json(
      {
        error: 'Invalid response shape',
        issues: process.env.NODE_ENV === 'development' ? parsed.error.issues : undefined,
      },
      { status: 500 }
    );
  }
  return NextResponse.json(parsed.data, { status });
}

/**
 * POST /api/auth/phone/verify
 * 
 * Verify a phone verification code and update user's verification status.
 */
export async function POST(req: Request) {
  const session = await MyLibUserAuth();
  
  if (!session?.id) {
    return respond(401, { error: 'Unauthorized' });
  }

  try {
    const json = await req.json();
    const parsed = PhoneVerifyBodySchema.safeParse(json);
    if (!parsed.success) {
      return respond(400, {
        error: 'Invalid code',
        message: 'Please enter a 6-digit verification code',
      });
    }
    const { code } = parsed.data;

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
      return respond(400, {
        error: 'No pending verification',
        message: 'Please request a new verification code',
      });
    }

    // Check attempts
    if (verification.attempts >= MAX_ATTEMPTS) {
      await dbPrisma.phoneVerification.update({
        where: { id: verification.id },
        data: { status: 'BLOCKED' },
      });
      
      return respond(429, {
        error: 'Too many attempts',
        message: 'Maximum attempts exceeded. Please request a new code.',
      });
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

      return respond(400, {
        error: 'Invalid code',
        message:
          attemptsRemaining > 0
            ? `Incorrect code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`
            : 'Incorrect code. No attempts remaining.',
        attemptsRemaining,
      });
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

    return respond(200, {
      success: true,
      message: 'Phone number verified successfully',
      phoneVerified: true,
      verificationTier: updatedUser?.verificationTier ?? null,
      verificationScore:
        typeof updatedUser?.verificationScore === 'number' ? updatedUser.verificationScore : null,
    });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error verifying code:', error);
    return respond(500, { error: 'Internal server error' });
  }
}
