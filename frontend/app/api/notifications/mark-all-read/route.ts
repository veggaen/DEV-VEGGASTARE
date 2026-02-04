import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbPrisma as db } from "@/lib/db";

// POST /api/notifications/mark-all-read - Mark all notifications as read
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.notification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false,
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
