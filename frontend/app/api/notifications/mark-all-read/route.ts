import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbPrisma as db } from "@/lib/db";
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { isDemoUserId } from '@/lib/demo-policy';

// POST /api/notifications/mark-all-read - Mark all notifications as read
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isDemoUserId(session.user.id)) return NextResponse.json({ error: 'Demo notifications are read-only' }, { status: 403 });
    const rl = await checkRateLimit(`notifications:write:${getClientIdentifier(request, session.user.id)}`, 'write');
    if (!rl.success) return rateLimitedResponse(rl);
    await db.notification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false,
        isArchived: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NOTIFICATIONS_MARK_ALL_READ]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
