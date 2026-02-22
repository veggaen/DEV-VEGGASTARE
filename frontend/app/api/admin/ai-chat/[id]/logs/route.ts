import { NextRequest, NextResponse } from "next/server";
import { MyLibUserAuth } from "@/lib/user-auth";
import { isAdmin } from "@/lib/admin";
import { dbPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ai-chat/[id]/logs
 * Paginated audit log for a specific AI conversation.
 * Requires ADMIN or OWNER role.
 *
 * Query params:
 *  - limit:  number (max 100, default 50)
 *  - cursor: string (id, for pagination)
 *  - action: filter by action type
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const cursor = searchParams.get("cursor") ?? undefined;
  const actionFilter = searchParams.get("action") ?? undefined;

  const logs = await dbPrisma.aiConvAuditLog.findMany({
    where: {
      conversationId: id,
      ...(actionFilter ? { action: actionFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      action: true,
      reason: true,
      ipAddress: true,
      metadata: true,
      createdAt: true,
      actorId: true,
      targetUserId: true,
    },
  });

  return NextResponse.json({
    logs,
    nextCursor: logs.length === limit ? logs[logs.length - 1]?.id : null,
  });
}
