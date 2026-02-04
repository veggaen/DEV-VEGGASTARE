import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbPrisma as db } from "@/lib/db";

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

    const body = await request.json();
    
    // Only allow specific fields to be updated (matching schema)
    const allowedFields = [
      // Global settings
      "pushEnabled",
      "emailEnabled",
      "soundEnabled",
      "vibrateEnabled",
      // Quiet hours
      "quietHoursEnabled",
      "quietHoursStart",
      "quietHoursEnd",
      "quietHoursTimezone",
      // Engagement toggles
      "heartbeatEnabled",
      "vibeEnabled",
      "repulseEnabled",
      // Social toggles
      "syncEnabled",
      "mentionEnabled",
      "replyEnabled",
      // Message toggles
      "dmEnabled",
      "groupMessageEnabled",
      "typingIndicatorEnabled",
      // Trend toggles
      "hotPulseEnabled",
      "milestoneEnabled",
      // Prompt toggles
      "vibeCheckEnabled",
      "dailyDigestEnabled",
      // Condensing
      "condenseNotifications",
      "condenseThreshold",
      // Premium
      "customSoundUrl",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

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
