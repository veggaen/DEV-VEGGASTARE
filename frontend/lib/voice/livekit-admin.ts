import "server-only";

/**
 * @fileOverview Server-side LiveKit room administration (RoomServiceClient).
 *   Enforces host decisions on the SFU: grant/revoke publish, server-mute, and
 *   remove a participant. All calls are best-effort — when LiveKit isn't
 *   configured, or the participant isn't currently connected, they no-op so the
 *   DB remains the source of truth and the action still succeeds logically.
 */

let cached: import("livekit-server-sdk").RoomServiceClient | null | undefined;

async function getClient() {
  if (cached !== undefined) return cached;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !wsUrl) {
    cached = null;
    return cached;
  }
  // RoomServiceClient wants an http(s) URL; the public ws URL maps 1:1.
  const httpUrl = wsUrl.replace(/^ws/, "http");
  const { RoomServiceClient } = await import("livekit-server-sdk");
  cached = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  return cached;
}

/** Grant or revoke audio publish for a participant (used by promote/demote). */
export async function setParticipantCanPublish(
  roomKey: string,
  identity: string,
  canPublish: boolean,
): Promise<void> {
  const client = await getClient();
  if (!client) return;
  try {
    await client.updateParticipant(roomKey, identity, undefined, {
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });
  } catch (e) {
    // Participant may not be connected right now — DB role still updated.
    console.warn("[livekit-admin] updateParticipant failed", roomKey, identity, e);
  }
}

/** Server-mute (or unmute) a participant's published audio tracks. */
export async function setParticipantMuted(
  roomKey: string,
  identity: string,
  muted: boolean,
): Promise<void> {
  const client = await getClient();
  if (!client) return;
  try {
    const { TrackType } = await import("livekit-server-sdk");
    const p = await client.getParticipant(roomKey, identity);
    await Promise.all(
      (p.tracks ?? [])
        .filter((t) => t.type === TrackType.AUDIO)
        .map((t) => client.mutePublishedTrack(roomKey, identity, t.sid, muted)),
    );
  } catch (e) {
    console.warn("[livekit-admin] mute failed", roomKey, identity, e);
  }
}

/** Forcibly disconnect a participant from the room. */
export async function removeParticipant(roomKey: string, identity: string): Promise<void> {
  const client = await getClient();
  if (!client) return;
  try {
    await client.removeParticipant(roomKey, identity);
  } catch (e) {
    console.warn("[livekit-admin] removeParticipant failed", roomKey, identity, e);
  }
}
