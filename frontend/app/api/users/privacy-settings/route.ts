import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { ensureUser } from '@/lib/ensure-user';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UserPrivacySettingsResponseSchema } from '@/lib/types/users';

const LOG_PREFIX = '[api/users/privacy-settings]';
const isDev = process.env.NODE_ENV !== 'production';

const updateSchema = z.object({
  showPulsesGiven: z.boolean().optional(),
  showPulsesReceived: z.boolean().optional(),
  showNegativePulses: z.boolean().optional(),
  showRepulses: z.boolean().optional(),
  allowNegativePulses: z.boolean().optional(),
});

/**
 * GET /api/users/privacy-settings
 * 
 * Get the current user's privacy settings
 */
export async function GET() {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Ensure user exists in DB before creating dependent records
    const ensureResult = await ensureUser(session);
    if (!ensureResult.success) {
      console.error(`${LOG_PREFIX} Failed to ensure user:`, ensureResult.error);
      return NextResponse.json({ message: 'Failed to initialize user' }, { status: 500 });
    }

    const userId = ensureResult.userId;

    // Use upsert to get or create settings atomically (avoids race conditions)
    const settings = await dbPrisma.userPrivacySettings.upsert({
      where: { userId },
      create: {
        userId,
        showPulsesGiven: true,
        showPulsesReceived: true,
        showNegativePulses: false,
        showRepulses: true,
        allowNegativePulses: true,
      },
      update: {}, // No updates needed, just return existing
    });

    const payload = {
      showPulsesGiven: settings.showPulsesGiven,
      showPulsesReceived: settings.showPulsesReceived,
      showNegativePulses: settings.showNegativePulses,
      showRepulses: settings.showRepulses,
      allowNegativePulses: settings.allowNegativePulses,
    };

    const validated = UserPrivacySettingsResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error(`${LOG_PREFIX} Invalid GET DTO:`, validated.error);
      return NextResponse.json(
        { message: 'Failed to get privacy settings', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);

  } catch (error) {
    console.error(`${LOG_PREFIX} GET Error:`, error);
    return NextResponse.json(
      { message: 'Failed to get privacy settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/privacy-settings
 * 
 * Update the current user's privacy settings
 */
export async function PATCH(req: Request) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const bodyResult = await parseJsonOrError(req, updateSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const updateData = bodyResult.data;

  try {
    // Ensure user exists in DB before upserting dependent records
    const ensureResult = await ensureUser(session);
    if (!ensureResult.success) {
      console.error(`${LOG_PREFIX} Failed to ensure user:`, ensureResult.error);
      return NextResponse.json({ message: 'Failed to initialize user' }, { status: 500 });
    }

    const userId = ensureResult.userId;

    // Upsert privacy settings
    const settings = await dbPrisma.userPrivacySettings.upsert({
      where: { userId },
      create: {
        userId,
        showPulsesGiven: updateData.showPulsesGiven ?? true,
        showPulsesReceived: updateData.showPulsesReceived ?? true,
        showNegativePulses: updateData.showNegativePulses ?? false,
        showRepulses: updateData.showRepulses ?? true,
        allowNegativePulses: updateData.allowNegativePulses ?? true,
      },
      update: updateData,
    });

    if (isDev) {
      console.log(`${LOG_PREFIX} Updated settings for user=${userId}:`, updateData);
    }

    const payload = {
      showPulsesGiven: settings.showPulsesGiven,
      showPulsesReceived: settings.showPulsesReceived,
      showNegativePulses: settings.showNegativePulses,
      showRepulses: settings.showRepulses,
      allowNegativePulses: settings.allowNegativePulses,
    };

    const validated = UserPrivacySettingsResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error(`${LOG_PREFIX} Invalid PATCH DTO:`, validated.error);
      return NextResponse.json(
        { message: 'Failed to update privacy settings', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);

  } catch (error) {
    console.error(`${LOG_PREFIX} PATCH Error:`, error);
    return NextResponse.json(
      { message: 'Failed to update privacy settings' },
      { status: 500 }
    );
  }
}
