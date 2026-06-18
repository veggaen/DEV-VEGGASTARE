import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { joinOrCreateChannel, canPublishRole, isManagerRole } from "@/lib/voice/channel-service";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

const schema = z.object({
  roomId: z.string().min(1).max(120),
  /** Link to a Conversation when minting from a DM/group chat. */
  conversationId: z.string().max(120).optional(),
  // NOTE: `isHost` is intentionally NOT read from the client anymore. Publish/admin
  // grants are derived server-side from VoiceChannelMember (see channel-service).
});

/**
 * POST /api/voice/token
 *
 * Mints a LiveKit access token whose publish/admin grants are derived from the
 * caller's persisted channel membership — NOT a client-claimed flag. Joining a
 * room with no channel auto-creates it and makes the caller HOST (the
 * "Vegga joins → Vegga's channel" behavior), so the very first token already
 * carries the right grants.
 *
 * Returns { configured:false } when LiveKit env keys aren't set — the client then
 * falls back to the stub provider, so the UI never breaks. This is the only
 * server-side secret-handling for voice; the client never sees the API secret.
 */
export async function POST(req: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !wsUrl) {
    // Not provisioned yet — client falls back to the stub.
    return NextResponse.json({ configured: false });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  // Resolve (or bootstrap) the caller's membership → authoritative grants.
  const { channel, member } = await joinOrCreateChannel({
    roomId: body.roomId,
    user: { id: session.id, name: session.name ?? null },
    conversationId: body.conversationId ?? null,
  });

  const canPublish = canPublishRole(member.role) && !member.mutedByHost;
  const roomAdmin = isManagerRole(member.role);

  // Dynamic import so the build/runtime never hard-requires the SDK unless used.
  const { AccessToken } = await import("livekit-server-sdk");

  const at = new AccessToken(apiKey, apiSecret, {
    identity: session.id,
    name: session.name ?? "Member",
    ttl: "2h",
  });
  at.addGrant({
    room: channel.roomKey,
    roomJoin: true,
    canSubscribe: true,
    canPublish,
    canPublishData: true,
    roomAdmin,
  });

  const token = await at.toJwt();
  return NextResponse.json({
    configured: true,
    token,
    url: wsUrl,
    role: member.role,
    isHost: roomAdmin,
  });
}
