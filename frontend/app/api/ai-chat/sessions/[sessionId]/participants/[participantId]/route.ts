import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  role: z.enum(["MODERATOR", "MEMBER"]), // OWNER can't be assigned/removed here
});

/**
 * Resolve the caller's authority over a conversation: is it loadable, and is the
 * caller an OWNER or MODERATOR (the roles allowed to manage members)?
 */
async function loadAndAuthorize(sessionId: string, userId: string) {
  const conv = await dbPrisma.aiConversation.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      creatorId: true,
      isDeleted: true,
      participants: { select: { id: true, userId: true, role: true, type: true } },
    },
  });
  if (!conv || conv.isDeleted) return { error: "NOT_FOUND" as const, status: 404 };
  const me = conv.participants.find((p) => p.userId === userId && p.type === "HUMAN");
  const isManager = conv.creatorId === userId || me?.role === "OWNER" || me?.role === "MODERATOR";
  if (!isManager) return { error: "FORBIDDEN" as const, status: 403 };
  return { conv };
}

/** PATCH — change a participant's role (promote to MODERATOR / demote to MEMBER). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; participantId: string }> },
) {
  const { sessionId, participantId } = await params;
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: z.infer<typeof patchSchema>;
  try { body = patchSchema.parse(await req.json()); }
  catch { return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 }); }

  const auth = await loadAndAuthorize(sessionId, session.id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const target = auth.conv.participants.find((p) => p.id === participantId);
  if (!target) return NextResponse.json({ error: "PARTICIPANT_NOT_FOUND" }, { status: 404 });
  // The OWNER's role is immutable here; you can't demote/promote the owner.
  if (target.role === "OWNER" || target.userId === auth.conv.creatorId) {
    return NextResponse.json({ error: "CANNOT_MODIFY_OWNER" }, { status: 403 });
  }

  const updated = await dbPrisma.aiConvParticipant.update({
    where: { id: participantId },
    data: { role: body.role },
    select: { id: true, role: true },
  });
  return NextResponse.json({ ok: true, participant: updated });
}

/** DELETE — remove a participant from the conversation. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; participantId: string }> },
) {
  const { sessionId, participantId } = await params;
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const auth = await loadAndAuthorize(sessionId, session.id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const target = auth.conv.participants.find((p) => p.id === participantId);
  if (!target) return NextResponse.json({ error: "PARTICIPANT_NOT_FOUND" }, { status: 404 });
  // Never remove the owner; moderators can't remove other moderators (only owner can).
  if (target.role === "OWNER" || target.userId === auth.conv.creatorId) {
    return NextResponse.json({ error: "CANNOT_REMOVE_OWNER" }, { status: 403 });
  }
  const meIsOwner = auth.conv.creatorId === session.id;
  if (target.role === "MODERATOR" && !meIsOwner) {
    return NextResponse.json({ error: "ONLY_OWNER_REMOVES_MODERATORS" }, { status: 403 });
  }

  await dbPrisma.aiConvParticipant.delete({ where: { id: participantId } });
  return NextResponse.json({ ok: true });
}
