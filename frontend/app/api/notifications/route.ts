import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbPrisma as db } from "@/lib/db";
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';

const ListNotificationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(200).optional(),
  unread: z.enum(['true', 'false']).default('false'),
  archived: z.enum(['true', 'false']).default('false'),
});

const CreateNotificationSchema = z.object({
  userId: z.string().min(1),
  type: z.enum([
    "HEARTBEAT", "VIBE", "REPULSE", "REPLY", "SYNC", "DM",
    "GROUP_MESSAGE", "MENTION", "HOT_PULSE", "MILESTONE",
    "VIBE_CHECK", "SYSTEM", "TRADE_REQUEST", "TRADE_ACCEPTED",
    "TRADE_COMPLETED", "TRADE_CANCELLED",
  ]),
  title: z.string().min(1).max(500),
  message: z.string().min(1).max(2000),
  emoji: z.string().max(20).optional(),
  preview: z.string().max(500).optional(),
  imageUrl: z.string().url().max(2048).optional().nullable(),
  actorId: z.string().optional(),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
  groupKey: z.string().max(200).optional(),
  metadata: z.any().optional().nullable(),
});

// GET /api/notifications - Fetch user notifications
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimit(`notifications:read:${getClientIdentifier(request, session.user.id)}`, 'read');
    if (!rl.success) return rateLimitedResponse(rl);
    const parsed = ListNotificationsSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid notification filters' }, { status: 400 });
    const { limit, cursor, unread, archived } = parsed.data;
    const active = { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
    const where: Prisma.NotificationWhereInput = {
      userId: session.user.id,
      isArchived: archived === 'true',
      AND: [active],
    };
    if (unread === 'true') where.isRead = false;
    if (cursor) {
      // A cursor is scoped to its owner, and sorted by the same tuple as the list.
      const anchor = await db.notification.findFirst({ where: { id: cursor, userId: session.user.id }, select: { id: true, createdAt: true } });
      if (!anchor) return NextResponse.json({ error: 'Invalid notification cursor. Refresh your inbox.' }, { status: 400 });
      where.AND = [active, { OR: [
        { createdAt: { lt: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { lt: anchor.id } },
      ] }];
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    if (notifications.length > limit) {
      notifications.pop();
      nextCursor = notifications.at(-1)?.id || null;
    }

    // Get unread count
    const unreadCount = await db.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
        isArchived: false,
        ...active,
      },
    });

    return NextResponse.json({
      notifications,
      nextCursor,
      unreadCount,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error("[NOTIFICATIONS_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/notifications - Create a notification (internal use)
// User actions create their own verified notifications on the server. This
// administrative endpoint must never let a member send forged system alerts.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!['ADMIN', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Only administrators can create notifications' }, { status: 403 });
    }
    // Rate limit
    const rl = await checkRateLimit(getClientIdentifier(request, session.user.id), 'write');
    if (!rl.success) return rateLimitedResponse(rl);

    const json = await request.json().catch(() => null);
    const parsed = CreateNotificationSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
    }
    const {
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
    } = parsed.data;

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
