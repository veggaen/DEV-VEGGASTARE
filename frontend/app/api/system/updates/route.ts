import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbPrisma as db } from "@/lib/db";
import {
  SYSTEM_ACCOUNT,
  canPostAsSystem,
  createSystemPulse,
  ensureSystemAccount,
  formatChangelogContent,
} from "@/lib/system-account";
import { z } from 'zod';

const SystemUpdateSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(10000).optional(),
  changes: z.array(z.string().max(1000)).max(50).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// GET /api/system/updates - Get system updates/changelogs
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const cursor = searchParams.get("cursor");

    // Ensure system account exists
    await ensureSystemAccount();

    const where: {
      userId: string;
      type: "PUBLIC_THREAD";
      id?: { lt: string };
    } = {
      userId: SYSTEM_ACCOUNT.id,
      type: "PUBLIC_THREAD",
    };

    if (cursor) {
      where.id = { lt: cursor };
    }

    const updates = await db.conversation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        Message: {
          take: 1,
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            Pulse: true,
            ConversationView: true,
            Message: true,
          },
        },
      },
    });

    let nextCursor: string | null = null;
    if (updates.length > limit) {
      const nextItem = updates.pop();
      nextCursor = nextItem?.id || null;
    }

    return NextResponse.json({
      updates,
      nextCursor,
    });
  } catch (error) {
    console.error("[SYSTEM_UPDATES_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/system/updates - Create a new system update (admin only)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can post as system
    const canPost = await canPostAsSystem(session.user.id);
    if (!canPost) {
      return NextResponse.json(
        { error: "You don't have permission to post system updates" },
        { status: 403 }
      );
    }

    const json = await request.json();
    const parsed = SystemUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { title, content, changes, tags } = parsed.data;

    // If changes array is provided, format it as changelog
    // Otherwise use raw content
    const finalContent = changes && Array.isArray(changes)
      ? formatChangelogContent(changes)
      : content || "No content provided.";

    const result = await createSystemPulse({
      title,
      content: finalContent,
      tags: tags || ["update"],
      postedByUserId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      conversationId: result.conversationId,
      notifiedUsers: result.notificationCount,
      message: `System update posted! ${result.notificationCount} users notified.`,
    });
  } catch (error) {
    console.error("[SYSTEM_UPDATES_POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
