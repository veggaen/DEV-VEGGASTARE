import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { joinOrCreateChannel, toUiRole } from "@/lib/voice/channel-service";
import { emitVoiceEvent, VoiceEvent } from "@/lib/voice/events";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** Link the channel to a Conversation when joining from one (DM/group). */
  conversationId: z.string().max(120).optional(),
  /** Override the auto name for a freshly-created personal channel. */
  channelName: z.string().min(1).max(80).optional(),
});

/**
 * POST /api/voice/[roomId]/join
 *
 * Join a voice channel, auto-creating it on first contact: the first person to
 * join becomes HOST (owner) — the "Vegga joins → Vegga's channel" behavior.
 * Idempotent. Returns the caller's resolved role so the client can render host
 * controls without trusting any client-claimed flag.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: z.infer<typeof schema>;
  try { body = schema.parse(await req.json().catch(() => ({}))); }
  catch { return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 }); }

  const { channel, member } = await joinOrCreateChannel({
    roomId,
    user: { id: session.id, name: session.name ?? null },
    conversationId: body.conversationId ?? null,
    channelName: body.channelName,
  });

  // Let everyone already in the room see the new presence.
  void emitVoiceEvent(channel.roomKey, VoiceEvent.MemberJoined, {
    userId: member.userId,
    role: member.role,
  });

  return NextResponse.json({
    ok: true,
    channel: { id: channel.id, name: channel.name, ownerUserId: channel.ownerUserId, isLocked: channel.isLocked },
    self: {
      userId: member.userId,
      role: member.role,
      uiRole: toUiRole(member.role),
      isHost: channel.ownerUserId === member.userId || member.role === "HOST" || member.role === "MODERATOR",
      mutedByHost: member.mutedByHost,
    },
  });
}
