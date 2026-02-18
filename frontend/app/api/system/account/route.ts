import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { 
  ensureSystemAccount, 
  canPostAsSystem,
  SYSTEM_ACCOUNT,
} from "@/lib/system-account";
import { dbPrisma as db } from "@/lib/db";
import { z } from 'zod';

const SystemAccountUpdateSchema = z.object({
  bio: z.string().max(2000).optional(),
  image: z.string().url().max(2048).optional(),
  banner: z.string().url().max(2048).optional(),
}).strict();

// GET /api/system/account - Get system account info
export async function GET() {
  try {
    await ensureSystemAccount();
    
    const systemUser = await db.user.findUnique({
      where: { id: SYSTEM_ACCOUNT.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        banner: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            Conversation: true,
            followers: true,
          },
        },
      },
    });

    return NextResponse.json(systemUser);
  } catch (error) {
    console.error("[SYSTEM_ACCOUNT_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/system/account - Initialize or update system account (admin only)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canPost = await canPostAsSystem(session.user.id);
    if (!canPost) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const json = await request.json();
    const parsed = SystemAccountUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { bio, image, banner } = parsed.data;

    await ensureSystemAccount();

    const updateData: { bio?: string; image?: string; banner?: string } = {};
    if (bio !== undefined) updateData.bio = bio;
    if (image !== undefined) updateData.image = image;
    if (banner !== undefined) updateData.banner = banner;

    const systemUser = await db.user.update({
      where: { id: SYSTEM_ACCOUNT.id },
      data: updateData,
    });

    return NextResponse.json(systemUser);
  } catch (error) {
    console.error("[SYSTEM_ACCOUNT_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
