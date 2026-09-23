import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbPrisma as db } from "@/lib/db";
import { z } from 'zod';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { isDemoUserId } from '@/lib/demo-policy';

const NotificationPatchSchema = z.object({
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
}).strict().refine(value => value.isRead !== undefined || value.isArchived !== undefined);

// GET /api/notifications/[id] - Get a single notification
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimit(`notifications:read:${getClientIdentifier(request, session.user.id)}`, 'read');
    if (!rl.success) return rateLimitedResponse(rl);
    const { id } = await params;

    const notification = await db.notification.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!notification) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(notification, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error("[NOTIFICATION_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications/[id] - Update notification (mark read, archive)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isDemoUserId(session.user.id)) return NextResponse.json({ error: 'Demo notifications are read-only' }, { status: 403 });
    const rl = await checkRateLimit(`notifications:write:${getClientIdentifier(request, session.user.id)}`, 'write');
    if (!rl.success) return rateLimitedResponse(rl);
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = NotificationPatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
    }
    const { isRead, isArchived } = parsed.data;

    // Verify ownership
    const existing = await db.notification.findFirst({
      where: { id, userId: session.user.id },
      select: { isRead: true, readAt: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: { isRead?: boolean; isArchived?: boolean; readAt?: Date | null } = {};
    
    if (typeof isRead === "boolean") {
      updateData.isRead = isRead;
      updateData.readAt = isRead ? (existing.readAt ?? new Date()) : null;
    }
    
    if (typeof isArchived === "boolean") {
      updateData.isArchived = isArchived;
    }

    const notification = await db.notification.update({
      where: { id, userId: session.user.id },
      data: updateData,
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error("[NOTIFICATION_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/[id] - Delete a notification
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isDemoUserId(session.user.id)) return NextResponse.json({ error: 'Demo notifications are read-only' }, { status: 403 });
    const rl = await checkRateLimit(`notifications:write:${getClientIdentifier(request, session.user.id)}`, 'write');
    if (!rl.success) return rateLimitedResponse(rl);
    const { id } = await params;
    const result = await db.notification.deleteMany({ where: { id, userId: session.user.id } });
    if (!result.count) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NOTIFICATION_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
