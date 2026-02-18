import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbPrisma as db } from "@/lib/db";
import { MuteType } from "@/generated/prisma/browser";
import { z } from 'zod';

const CreateMuteSchema = z.object({
  mutedUserId: z.string().optional(),
  conversationId: z.string().optional(),
  companyId: z.string().optional(),
  muteType: z.enum(["ALL", "MESSAGES_ONLY", "ENGAGEMENT_ONLY", "MENTIONS_ONLY"]).default("ALL"),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
}).refine(
  (data) => data.mutedUserId || data.conversationId || data.companyId,
  { message: "Must specify mutedUserId, conversationId, or companyId" }
);

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

    const json = await request.json();
    const parsed = CreateMuteSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { 
      mutedUserId, 
      conversationId, 
      companyId, 
      muteType, 
      reason, 
      expiresAt 
    } = parsed.data;

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
