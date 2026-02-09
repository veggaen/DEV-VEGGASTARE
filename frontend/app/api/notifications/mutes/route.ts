import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbPrisma as db } from "@/lib/db";
import { MuteType } from "@/generated/prisma/browser";

// GET /api/notifications/mutes - Get user's muted users/conversations
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mutes = await db.notificationMute.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { mutedAt: "desc" },
    });

    return NextResponse.json(mutes);
  } catch (error) {
    console.error("[NOTIFICATION_MUTES_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/notifications/mutes - Create a new mute
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      mutedUserId, 
      conversationId, 
      companyId, 
      muteType = "ALL", 
      reason, 
      expiresAt 
    } = body;

    // Must have at least one target
    if (!mutedUserId && !conversationId && !companyId) {
      return NextResponse.json(
        { error: "Must specify mutedUserId, conversationId, or companyId" },
        { status: 400 }
      );
    }

    // Validate muteType
    const validMuteTypes: MuteType[] = ["ALL", "MESSAGES_ONLY", "ENGAGEMENT_ONLY", "MENTIONS_ONLY"];
    if (!validMuteTypes.includes(muteType as MuteType)) {
      return NextResponse.json(
        { error: "Invalid muteType" },
        { status: 400 }
      );
    }

    // Build unique constraint check
    const whereClause: {
      userId: string;
      mutedUserId?: string;
      conversationId?: string;
      companyId?: string;
    } = {
      userId: session.user.id,
    };

    if (mutedUserId) whereClause.mutedUserId = mutedUserId;
    if (conversationId) whereClause.conversationId = conversationId;
    if (companyId) whereClause.companyId = companyId;

    // Check if already muted
    const existing = await db.notificationMute.findFirst({
      where: whereClause,
    });

    if (existing) {
      // Update existing mute
      const mute = await db.notificationMute.update({
        where: { id: existing.id },
        data: {
          muteType: muteType as MuteType,
          reason,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });
      return NextResponse.json(mute);
    }

    // Create new mute
    const mute = await db.notificationMute.create({
      data: {
        userId: session.user.id,
        mutedUserId,
        conversationId,
        companyId,
        muteType: muteType as MuteType,
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json(mute);
  } catch (error) {
    console.error("[NOTIFICATION_MUTES_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
