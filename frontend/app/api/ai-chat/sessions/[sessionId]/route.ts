import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  isPublic: z.boolean().optional(),
  triggerMode: z.enum(["MENTION", "DEBOUNCE", "ALL", "MANUAL"]).optional(),
  debounceMs: z.number().int().min(500).max(30000).optional(),
  allTriggerEnabled: z.boolean().optional(),
  heartbeatEnabled: z.boolean().optional(),
});

// GET — fetch session details + messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const conv = await dbPrisma.aiConversation.findUnique({
    where: { id: sessionId },
    include: {
      participants: {
        where: { isActive: true },
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        include: {
          reactions: true,
          participant: { select: { id: true, type: true, displayName: true, aiModel: true } },
        },
      },
    },
  });

  if (!conv) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Only creator or participants can view non-public conversations
  const isParticipant = conv.participants.some((p) => p.userId === session.id);
  const isOwner = conv.creatorId === session.id;
  if (!conv.isPublic && !isOwner && !isParticipant) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  return NextResponse.json(conv);
}

// PATCH — update conversation settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const conv = await dbPrisma.aiConversation.findUnique({
    where: { id: sessionId },
    select: { creatorId: true, isSuspended: true, isDeleted: true },
  });
  if (!conv) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (conv.isDeleted) return NextResponse.json({ error: "DELETED" }, { status: 410 });
  if (conv.creatorId !== session.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const updated = await dbPrisma.aiConversation.update({
    where: { id: sessionId },
    data: body,
    select: { id: true, title: true, isPublic: true, triggerMode: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}

// DELETE — soft-delete session
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const conv = await dbPrisma.aiConversation.findUnique({
    where: { id: sessionId },
    select: { creatorId: true },
  });
  if (!conv) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (conv.creatorId !== session.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await dbPrisma.aiConversation.update({
    where: { id: sessionId },
    data: { isDeleted: true, deletedAt: new Date(), deletedBy: session.id },
  });

  return NextResponse.json({ success: true });
}
