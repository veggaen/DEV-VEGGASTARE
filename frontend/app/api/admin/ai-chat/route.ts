import { NextRequest, NextResponse } from "next/server";
import { MyLibUserAuth } from "@/lib/user-auth";
import { isAdmin } from "@/lib/admin";
import { dbPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const LOG_PREFIX = "[api/admin/ai-chat]";

/**
 * GET /api/admin/ai-chat
 * List all AiConversations with moderation metadata.
 * Requires ADMIN or OWNER role.
 *
 * Query params:
 *  - isSuspended: "true" | "false"
 *  - isPublic:    "true" | "false"
 *  - isDeleted:   "true" | "false" (default false)
 *  - creatorId:   string (filter by creator)
 *  - search:      string (title substring, case-insensitive)
 *  - from:        ISO date string
 *  - to:          ISO date string
 *  - limit:       number (max 100, default 50)
 *  - cursor:      string (id, for pagination)
 */
export async function GET(req: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const cursor = searchParams.get("cursor") ?? undefined;

  // Build filter
  const where: Record<string, unknown> = {};

  const isSuspendedParam = searchParams.get("isSuspended");
  if (isSuspendedParam !== null) {
    where.isSuspended = isSuspendedParam === "true";
  }

  const isPublicParam = searchParams.get("isPublic");
  if (isPublicParam !== null) {
    where.isPublic = isPublicParam === "true";
  }

  // By default hide deleted unless explicitly requested
  const isDeletedParam = searchParams.get("isDeleted");
  where.isDeleted = isDeletedParam === "true";

  const creatorId = searchParams.get("creatorId");
  if (creatorId) {
    where.creatorId = creatorId;
  }

  const search = searchParams.get("search");
  if (search) {
    where.title = { contains: search, mode: "insensitive" };
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    where.createdAt = dateFilter;
  }

  try {
    const conversations = await dbPrisma.aiConversation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        isPublic: true,
        isDeleted: true,
        isSuspended: true,
        suspendedReason: true,
        suspendedAt: true,
        suspendedBy: true,
        deletedAt: true,
        deletedBy: true,
        triggerMode: true,
        createdAt: true,
        updatedAt: true,
        creator: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
        _count: {
          select: {
            messages: true,
            participants: true,
          },
        },
      },
    });

    // Fetch flagged/injection audit event counts per conversation in one query
    const ids = conversations.map((c) => c.id);
    const auditCounts = await dbPrisma.aiConvAuditLog.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: ids },
        action: { in: ["INJECTION_BLOCKED", "FLAG", "RATE_LIMIT_HIT"] },
      },
      _count: { id: true },
    });

    const auditCountMap = new Map(
      auditCounts.map((a) => [a.conversationId, a._count.id])
    );

    const result = conversations.map((c) => ({
      ...c,
      flagCount: auditCountMap.get(c.id) ?? 0,
    }));

    return NextResponse.json({
      conversations: result,
      nextCursor: conversations.length === limit ? conversations[conversations.length - 1]?.id : null,
    });
  } catch (err) {
    console.error(`${LOG_PREFIX} Error listing conversations:`, err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
