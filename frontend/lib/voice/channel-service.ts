import "server-only";

/**
 * @fileOverview Voice channel service — the server-side source of truth for voice
 *   channel membership and roles. Routes (token mint, join, host actions) are thin
 *   wrappers over this. See docs/VOICE_AND_DICTATION_DESIGN.md.
 *
 *   Key ideas:
 *   - A channel is resolved/created by its stable `roomKey` (= the namespaced room
 *     the client joins, "vegga_<roomId>"), uniformly for AI sessions, DM/group
 *     conversations, and personal channels.
 *   - Joining where no channel exists auto-creates a personal channel and makes
 *     the joiner HOST (the "Vegga joins → Vegga's channel" behavior).
 *   - Publish/admin authorization derives from VoiceChannelMember.role, NEVER from
 *     a client-claimed flag.
 */

import { dbPrisma } from "@/lib/db";
import type { VoiceRoleDB } from "@/generated/prisma/client";
import type { VoiceRole } from "./types";

/** The room-name prefix LiveKit rooms are namespaced under (matches /api/voice/token). */
export const ROOM_PREFIX = "vegga_";

/** Build the stable channel lookup key from a UI roomId. */
export function roomKeyForRoomId(roomId: string): string {
  return roomId.startsWith(ROOM_PREFIX) ? roomId : `${ROOM_PREFIX}${roomId}`;
}

/** Roles permitted to manage members (promote/demote/mute/remove). */
export function isManagerRole(role: VoiceRoleDB): boolean {
  return role === "HOST" || role === "MODERATOR";
}

/** Roles permitted to publish audio to the room. */
export function canPublishRole(role: VoiceRoleDB): boolean {
  return role === "HOST" || role === "MODERATOR" || role === "SPEAKER";
}

/** Map the DB role (4-way) onto the UI's 3-way VoiceRole. */
export function toUiRole(role: VoiceRoleDB): VoiceRole {
  if (role === "HOST" || role === "MODERATOR") return "host";
  if (role === "SPEAKER") return "speaker";
  return "listener";
}

export interface ResolvedMembership {
  channel: {
    id: string;
    roomKey: string;
    ownerUserId: string;
    name: string;
    isLocked: boolean;
    maxSpeakers: number | null;
  };
  member: {
    id: string;
    userId: string;
    role: VoiceRoleDB;
    mutedByHost: boolean;
  };
}

interface JoinArgs {
  roomId: string;
  user: { id: string; name: string | null };
  /** Link the channel to a Conversation when this join originates from one. */
  conversationId?: string | null;
  /** Display name for an auto-created personal channel (defaults to "<Name>'s channel"). */
  channelName?: string;
}

/**
 * Resolve the caller's membership for a room, creating the channel + membership on
 * first contact. The FIRST person to touch a room becomes its HOST (owner); later
 * joiners are LISTENERs. Idempotent: re-joining returns the existing rows and
 * refreshes lastSeenAt.
 */
export async function joinOrCreateChannel(args: JoinArgs): Promise<ResolvedMembership> {
  const roomKey = roomKeyForRoomId(args.roomId);
  const firstName = (args.user.name ?? "").trim().split(/\s+/)[0] || "My";
  const channelName = args.channelName?.trim() || `${firstName}'s channel`;

  return dbPrisma.$transaction(async (tx) => {
    let channel = await tx.voiceChannel.findUnique({
      where: { roomKey },
      select: { id: true, roomKey: true, ownerUserId: true, name: true, isLocked: true, maxSpeakers: true },
    });

    // First contact → create the channel; the creator owns it and is HOST.
    const isCreating = !channel;
    if (!channel) {
      channel = await tx.voiceChannel.create({
        data: {
          roomKey,
          conversationId: args.conversationId ?? null,
          ownerUserId: args.user.id,
          name: channelName,
          slug: slugify(channelName, args.user.id),
          isPersonal: !args.conversationId,
        },
        select: { id: true, roomKey: true, ownerUserId: true, name: true, isLocked: true, maxSpeakers: true },
      });
    }

    const initialRole: VoiceRoleDB = isCreating || channel.ownerUserId === args.user.id ? "HOST" : "LISTENER";

    // Upsert membership. On re-join we keep the existing role but bump lastSeenAt.
    const member = await tx.voiceChannelMember.upsert({
      where: { channelId_userId: { channelId: channel.id, userId: args.user.id } },
      create: { channelId: channel.id, userId: args.user.id, role: initialRole },
      update: { lastSeenAt: new Date() },
      select: { id: true, userId: true, role: true, mutedByHost: true },
    });

    return { channel, member };
  });
}

/**
 * Read-only resolve: the caller's membership for a room, or null if no channel /
 * not a member. Used by the token route to derive grants without mutating state.
 */
export async function resolveMembership(
  roomId: string,
  userId: string,
): Promise<ResolvedMembership | null> {
  const roomKey = roomKeyForRoomId(roomId);
  const channel = await dbPrisma.voiceChannel.findUnique({
    where: { roomKey },
    select: {
      id: true, roomKey: true, ownerUserId: true, name: true, isLocked: true, maxSpeakers: true,
      members: {
        where: { userId },
        select: { id: true, userId: true, role: true, mutedByHost: true },
        take: 1,
      },
    },
  });
  if (!channel) return null;
  const member = channel.members[0];
  if (!member) return null;
  const { members: _omit, ...channelFields } = channel;
  void _omit;
  return { channel: channelFields, member };
}

/**
 * Authorize a management action: load the actor's membership and confirm they may
 * manage members. Returns the channel + actor, or a typed error.
 */
export async function authorizeManager(
  roomId: string,
  actorUserId: string,
): Promise<
  | { ok: true; channelId: string; ownerUserId: string; actorRole: VoiceRoleDB }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN"; status: 404 | 403 }
> {
  const m = await resolveMembership(roomId, actorUserId);
  if (!m) return { ok: false, error: "NOT_FOUND", status: 404 };
  if (!isManagerRole(m.member.role)) return { ok: false, error: "FORBIDDEN", status: 403 };
  return { ok: true, channelId: m.channel.id, ownerUserId: m.channel.ownerUserId, actorRole: m.member.role };
}

/** Slug from a display name, suffixed with a short owner hash to keep it unique per owner. */
function slugify(name: string, ownerId: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "channel";
  return `${base}-${ownerId.slice(0, 6)}`;
}
