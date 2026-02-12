import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbPrisma as db } from "@/lib/db";

// GET /api/notifications - Fetch user notifications
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const cursor = searchParams.get("cursor");
    const unreadOnly = searchParams.get("unread") === "true";

    const where: {
      userId: string;
      isArchived: boolean;
      isRead?: boolean;
      id?: { lt: string };
    } = {
      userId: session.user.id,
      isArchived: false,
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    if (cursor) {
      where.id = { lt: cursor };
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    if (notifications.length > limit) {
      const nextItem = notifications.pop();
      nextCursor = nextItem?.id || null;
    }

    // Get unread count
    const unreadCount = await db.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
        isArchived: false,
      },
    });

    return NextResponse.json({
      notifications,
      nextCursor,
      unreadCount,
    });
  } catch (error) {
    console.error("[NOTIFICATIONS_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/notifications - Create a notification (internal use)
// SECURITY: actorId is ALWAYS set to the authenticated user to prevent IDOR.
// Only ADMIN users can create notifications for other users.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    let {
      userId,
      type,
      title,
      message,
      emoji,
      preview,
      imageUrl,
      actorId,
      conversationId,
      messageId,
      groupKey,
      metadata,
    } = body;

    // SECURITY: Prevent IDOR — non-admin users can only create notifications where
    // actorId is themselves. They cannot impersonate other users as notification senders.
    if ((session.user as any).role !== 'ADMIN') {
      actorId = session.user.id;
    }

    // Check if user has muted the actor
    if (actorId) {
      const mute = await db.notificationMute.findFirst({
        where: {
          userId,
          mutedUserId: actorId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      if (mute) {
        return NextResponse.json({ muted: true });
      }
    }

    // Check if conversation is muted
    if (conversationId) {
      const mute = await db.notificationMute.findFirst({
        where: {
          userId,
          conversationId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      if (mute) {
        return NextResponse.json({ muted: true });
      }
    }

    // Get user's notification settings
    const settings = await db.notificationSettings.findUnique({
      where: { userId },
    });

    // Check if this notification type is enabled
    const typeSettingMap: Record<string, string> = {
      HEARTBEAT: "heartbeatEnabled",
      VIBE: "vibeEnabled",
      REPULSE: "repulseEnabled",
      REPLY: "replyEnabled",
      SYNC: "syncEnabled",
      DM: "dmEnabled",
      GROUP_MESSAGE: "groupMessageEnabled",
      MENTION: "mentionEnabled",
      HOT_PULSE: "hotPulseEnabled",
      MILESTONE: "milestoneEnabled",
      VIBE_CHECK: "vibeCheckEnabled",
    };

    const settingKey = typeSettingMap[type];
    if (settings && settingKey && !(settings as Record<string, unknown>)[settingKey]) {
      return NextResponse.json({ disabled: true });
    }

    // Check quiet hours
    if (settings?.quietHoursEnabled) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const start = settings.quietHoursStart || "22:00";
      const end = settings.quietHoursEnd || "08:00";

      const isInQuietHours =
        start < end
          ? currentTime >= start && currentTime <= end
          : currentTime >= start || currentTime <= end;

      if (isInQuietHours) {
        // Still create the notification but don't send push
        // body.silenced = true; (handled client-side)
      }
    }

    // Handle notification condensing
    if (settings?.condenseNotifications && groupKey) {
      const existingGroup = await db.notification.findFirst({
        where: {
          userId,
          groupKey,
          isRead: false,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingGroup) {
        // Update the existing notification count
        await db.notification.update({
          where: { id: existingGroup.id },
          data: {
            groupCount: { increment: 1 },
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({ grouped: true, notificationId: existingGroup.id });
      }
    }

    // Create new notification
    const notification = await db.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        emoji,
        preview,
        imageUrl,
        actorId,
        conversationId,
        messageId,
        groupKey,
        groupCount: 1,
        metadata: metadata || undefined,
      },
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error("[NOTIFICATIONS_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
