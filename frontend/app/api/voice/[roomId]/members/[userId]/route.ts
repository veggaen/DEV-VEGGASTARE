import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";
import { authorizeManager, roomKeyForRoomId } from "@/lib/voice/channel-service";
import {
  setParticipantCanPublish,
  setParticipantMuted,
  removeParticipant,
} from "@/lib/voice/livekit-admin";
import { emitVoiceEvent, VoiceEvent } from "@/lib/voice/events";
import type { VoiceRoleDB } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const patchSchema = z.union([
  z.object({ action: z.literal("promote") }), // → SPEAKER (or keep MODERATOR/HOST)
  z.object({ action: z.literal("demote") }), //  → LISTENER
  z.object({ action: z.literal("makeModerator") }),
  z.object({ action: z.literal("mute"), muted: z.boolean() }),
]);

/**
 * PATCH /api/voice/[roomId]/members/[userId]
 *
 * Host/moderator actions on a member: promote (grant publish), demote (revoke),
 * makeModerator, or server-mute. Authority is derived from the ACTOR's persisted
 * role — never a client claim. Persists to VoiceChannelMember, enforces on the
 * LiveKit SFU, then broadcasts via Pusher so every client updates.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; userId: string }> },
) {
  const { roomId, userId: targetUserId } = await params;
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: z.infer<typeof patchSchema>;
  try { body = patchSchema.parse(await req.json()); }
  catch { return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 }); }

  const auth = await authorizeManager(roomId, session.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // The owner is untouchable, and only the owner may create moderators.
  if (targetUserId === auth.ownerUserId) {
    return NextResponse.json({ error: "CANNOT_MODIFY_OWNER" }, { status: 403 });
  }
  if (body.action === "makeModerator" && auth.ownerUserId !== session.id) {
    return NextResponse.json({ error: "ONLY_OWNER_ASSIGNS_MODERATORS" }, { status: 403 });
  }

  const roomKey = roomKeyForRoomId(roomId);

  // ── Mute / unmute ──────────────────────────────────────────────────────────
  if (body.action === "mute") {
    const updated = await dbPrisma.voiceChannelMember.update({
      where: { channelId_userId: { channelId: auth.channelId, userId: targetUserId } },
      data: { mutedByHost: body.muted },
      select: { userId: true, mutedByHost: true },
    });
    await setParticipantMuted(roomKey, targetUserId, body.muted);
    void emitVoiceEvent(roomKey, VoiceEvent.MemberMuted, {
      userId: updated.userId,
      mutedByHost: updated.mutedByHost,
      byUserId: session.id,
    });
    return NextResponse.json({ ok: true, member: updated });
  }

  // ── Role change ────────────────────────────────────────────────────────────
  const nextRole: VoiceRoleDB =
    body.action === "promote" ? "SPEAKER"
    : body.action === "makeModerator" ? "MODERATOR"
    : "LISTENER";
  const canPublish = nextRole !== "LISTENER";

  const updated = await dbPrisma.voiceChannelMember.update({
    where: { channelId_userId: { channelId: auth.channelId, userId: targetUserId } },
    data: { role: nextRole },
    select: { userId: true, role: true },
  });
  await setParticipantCanPublish(roomKey, targetUserId, canPublish);
  void emitVoiceEvent(roomKey, VoiceEvent.RoleChanged, {
    userId: updated.userId,
    role: updated.role,
    byUserId: session.id,
  });
  return NextResponse.json({ ok: true, member: updated });
}

/**
 * DELETE /api/voice/[roomId]/members/[userId] — remove a member from the channel
 * and disconnect them from the SFU.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string; userId: string }> },
) {
  const { roomId, userId: targetUserId } = await params;
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const auth = await authorizeManager(roomId, session.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (targetUserId === auth.ownerUserId) {
    return NextResponse.json({ error: "CANNOT_REMOVE_OWNER" }, { status: 403 });
  }

  // A moderator can't remove another moderator — only the owner can.
  const target = await dbPrisma.voiceChannelMember.findUnique({
    where: { channelId_userId: { channelId: auth.channelId, userId: targetUserId } },
    select: { role: true },
  });
  if (!target) return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  if (target.role === "MODERATOR" && auth.ownerUserId !== session.id) {
    return NextResponse.json({ error: "ONLY_OWNER_REMOVES_MODERATORS" }, { status: 403 });
  }

  const roomKey = roomKeyForRoomId(roomId);
  await dbPrisma.voiceChannelMember.delete({
    where: { channelId_userId: { channelId: auth.channelId, userId: targetUserId } },
  });
  await removeParticipant(roomKey, targetUserId);
  void emitVoiceEvent(roomKey, VoiceEvent.MemberRemoved, {
    userId: targetUserId,
    byUserId: session.id,
  });
  return NextResponse.json({ ok: true });
}
