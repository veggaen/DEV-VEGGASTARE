/**
 * Phone Verification API Routes
 * 
 * POST /api/auth/phone/send - Send verification code
 * POST /api/auth/phone/verify - Verify code and update user
 */

import { NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import {
  sendVerificationCode,
  formatPhoneE164,
  isValidPhoneNumber,
  getCountryFromPhone,
  verifyCodeHash,
  getAvailableProvider,
  isPhoneVerificationAvailable,
} from '@/lib/phone-verification';
import { calculateVerificationScore, determineUserVerificationTier } from '@/lib/view-strength';
import { PhoneSendResponseSchema } from '@/lib/types/phone-verification';
import { z } from 'zod';

const PhoneSendBodySchema = z.object({
  phoneNumber: z.string().min(1).max(30),
  countryCode: z.string().length(2).default('NO'),
});

const LOG_PREFIX = '[api/auth/phone]';
const MAX_ATTEMPTS = 3;
const COOLDOWN_MINUTES = 1; // Minimum time between code sends
const EXPIRATION_MINUTES = 10;

function respond(status: number, dto: unknown) {
  const parsed = PhoneSendResponseSchema.safeParse(dto);
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
 * POST /api/auth/phone/send
 * 
 * Send a verification code to the user's phone number.
 * Requires authentication.
 */
export async function POST(req: Request) {
  const session = await MyLibUserAuth();
  
  if (!session?.id) {
    return respond(401, { error: 'Unauthorized' });
  }

  // Check if phone verification is configured
  if (!isPhoneVerificationAvailable()) {
    return respond(503, {
      error: 'Phone verification is not currently available',
      message: 'SMS service is not configured. Please contact support.',
    });
  }

  try {
    const json = await req.json();
    const parsed = PhoneSendBodySchema.safeParse(json);
    if (!parsed.success) {
      return respond(400, { error: 'Invalid payload' });
    }
    const { phoneNumber, countryCode } = parsed.data;

    // Format and validate phone number
    const formattedPhone = formatPhoneE164(phoneNumber, countryCode);
    if (!isValidPhoneNumber(formattedPhone)) {
      return respond(400, {
        error: 'Invalid phone number format',
        message: 'Please enter a valid phone number',
      });
    }

    // Check if phone is already verified by another user
    const existingUser = await dbPrisma.user.findFirst({
      where: {
        phoneNumber: formattedPhone,
        phoneVerified: { not: null },
        id: { not: session.id },
      },
    });

    if (existingUser) {
      return respond(409, {
        error: 'Phone number already in use',
        message: 'This phone number is already associated with another account',
      });
    }

    // Check for recent pending verification (cooldown)
    const recentVerification = await dbPrisma.phoneVerification.findFirst({
      where: {
        userId: session.id,
        status: 'PENDING',
        lastSentAt: {
          gt: new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000),
        },
      },
    });

    if (recentVerification) {
      const waitSeconds = Math.ceil(
        (recentVerification.lastSentAt!.getTime() + COOLDOWN_MINUTES * 60 * 1000 - Date.now()) / 1000
      );
      return respond(429, {
        error: 'Too many requests',
        message: `Please wait ${waitSeconds} seconds before requesting a new code`,
        retryAfter: waitSeconds,
      });
    }

    // Get available provider
    const provider = getAvailableProvider()!;

    // Send verification code
    const result = await sendVerificationCode(formattedPhone, {
      provider,
      codeLength: 6,
      expirationMinutes: EXPIRATION_MINUTES,
    });

    if (!result.success) {
      console.error(LOG_PREFIX, 'Failed to send code:', result.error);
      return respond(500, {
        error: 'Failed to send verification code',
        message: result.error || 'Please try again later',
      });
    }

    // Cancel any existing pending verifications
    await dbPrisma.phoneVerification.updateMany({
      where: {
        userId: session.id,
        status: 'PENDING',
      },
      data: {
        status: 'EXPIRED',
      },
    });

    // Create new verification record
    await dbPrisma.phoneVerification.create({
      data: {
        userId: session.id,
        phoneNumber: formattedPhone,
        countryCode: getCountryFromPhone(formattedPhone) || countryCode,
        provider,
        code: result.codeHash, // Store hashed code
        attempts: 0,
        status: 'PENDING',
        expiresAt: result.expiresAt,
        lastSentAt: new Date(),
      },
    });

    console.log(LOG_PREFIX, `Verification code sent to ${formattedPhone.slice(0, -4)}**** for user ${session.id}`);

    return respond(200, {
      success: true,
      message: 'Verification code sent',
      expiresAt: result.expiresAt.toISOString(),
      provider,
      phoneNumber: formattedPhone.slice(0, -4) + '****', // Masked for security
    });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error sending verification code:', error);
    return respond(500, { error: 'Internal server error' });
  }
}
