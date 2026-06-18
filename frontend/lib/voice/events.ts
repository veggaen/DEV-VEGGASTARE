import "server-only";

/**
 * @fileOverview Voice realtime events — thin, typed wrapper over the existing
 *   Pusher server so every client in a voice channel learns about membership and
 *   role changes instantly. Channel names are auto-scoped per environment by the
 *   shared pusherServer (see lib/pusher.ts).
 */

import { pusherServer } from "@/lib/pusher";
import type { VoiceRoleDB } from "@/generated/prisma/client";

/** Pusher channel that carries a single voice room's events. */
export function voicePusherChannel(roomKey: string): string {
  // Pusher channel names disallow some chars; roomKey is already "vegga_<id>".
  return `voice-${roomKey}`;
}

export const VoiceEvent = {
  MemberJoined: "member:joined",
  MemberLeft: "member:left",
  RoleChanged: "member:role",
  MemberMuted: "member:muted",
  MemberRemoved: "member:removed",
} as const;

export type VoiceEventName = (typeof VoiceEvent)[keyof typeof VoiceEvent];

interface RoleChangedPayload {
  userId: string;
  role: VoiceRoleDB;
  byUserId: string;
}
interface MemberMutedPayload {
  userId: string;
  mutedByHost: boolean;
  byUserId: string;
}
interface MemberRemovedPayload {
  userId: string;
  byUserId: string;
}
interface MemberPresencePayload {
  userId: string;
  role: VoiceRoleDB;
}

/** Fire-and-forget emit; failures never block the request path. */
export async function emitVoiceEvent(
  roomKey: string,
  event: VoiceEventName,
  payload: RoleChangedPayload | MemberMutedPayload | MemberRemovedPayload | MemberPresencePayload,
): Promise<void> {
  try {
    await pusherServer.trigger(voicePusherChannel(roomKey), event, payload);
  } catch (e) {
    console.error("[voice/events] emit failed", event, e);
  }
}
