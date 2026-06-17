import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

const schema = z.object({
  roomId: z.string().min(1).max(120),
  /** Host gets publish + room-admin permissions; listeners are subscribe-only. */
  isHost: z.boolean().optional(),
});

/**
 * POST /api/voice/token
 *
 * Mints a LiveKit access token so the client can join a room's voice channel.
 * Returns { configured:false } when LiveKit env keys aren't set — the client
 * then falls back to the stub provider, so the UI never breaks. This is the only
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

  // Dynamic import so the build/runtime never hard-requires the SDK unless used.
  const { AccessToken } = await import("livekit-server-sdk");

  const at = new AccessToken(apiKey, apiSecret, {
    identity: session.id,
    name: (session as { name?: string }).name ?? "Member",
    ttl: "2h",
  });
  at.addGrant({
    room: `vegga_${body.roomId}`,
    roomJoin: true,
    canSubscribe: true,
    // Only hosts may publish audio and administer the room by default; listeners
    // are promoted to publish via host action (server re-issues a token or uses
    // updateParticipant server-side in a later pass).
    canPublish: !!body.isHost,
    canPublishData: true,
    roomAdmin: !!body.isHost,
  });

  const token = await at.toJwt();
  return NextResponse.json({ configured: true, token, url: wsUrl });
}
