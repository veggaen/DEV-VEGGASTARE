import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbPrisma as db } from "@/lib/db";
import { z } from 'zod';

const NotificationSettingsSchema = z.object({
  // Global settings
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  vibrateEnabled: z.boolean().optional(),
  // Quiet hours
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursTimezone: z.string().max(100).optional(),
  // Engagement toggles
  heartbeatEnabled: z.boolean().optional(),
  vibeEnabled: z.boolean().optional(),
  repulseEnabled: z.boolean().optional(),
  // Social toggles
  syncEnabled: z.boolean().optional(),
  mentionEnabled: z.boolean().optional(),
  replyEnabled: z.boolean().optional(),
  // Message toggles
  dmEnabled: z.boolean().optional(),
  groupMessageEnabled: z.boolean().optional(),
  typingIndicatorEnabled: z.boolean().optional(),
  // Trend toggles
  hotPulseEnabled: z.boolean().optional(),
  milestoneEnabled: z.boolean().optional(),
  // Prompt toggles
  vibeCheckEnabled: z.boolean().optional(),
  dailyDigestEnabled: z.boolean().optional(),
  // Condensing
  condenseNotifications: z.boolean().optional(),
  condenseThreshold: z.number().int().min(1).max(100).optional(),
  // Premium
  customSoundUrl: z.string().url().max(2048).optional().nullable(),
}).strict();

// GET /api/notifications/settings - Get user's notification settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let settings = await db.notificationSettings.findUnique({
      where: { userId: session.user.id },
    });

    // Create default settings if none exist
    if (!settings) {
      settings = await db.notificationSettings.create({
        data: {
          userId: session.user.id,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("[NOTIFICATION_SETTINGS_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications/settings - Update user's notification settings
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const parsed = NotificationSettingsSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
    }

    const updateData = parsed.data;

    // Upsert settings (create if doesn't exist)
    const settings = await db.notificationSettings.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        ...updateData,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("[NOTIFICATION_SETTINGS_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
