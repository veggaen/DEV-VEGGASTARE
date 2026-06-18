"use client";

/**
 * @fileOverview useVoiceChannelEvents — subscribes to a voice channel's Pusher
 *   events and forwards them to the provider as ServerVoiceEvents, so role/mute/
 *   remove decisions made by a host on the server reflect live in this client.
 *   Mirrors the server emit in lib/voice/events.ts.
 */

import { useCallback } from "react";
import usePusher from "@/hooks/usePusher";
import type { ServerVoiceEvent } from "./types";

type DbRole = "HOST" | "MODERATOR" | "SPEAKER" | "LISTENER";

// Must match lib/voice/events.ts (channel name + event names + payloads).
function channelName(roomKey: string) {
  return `voice-${roomKey}`;
}

interface RolePayload { userId: string; role: DbRole }
interface MutedPayload { userId: string; mutedByHost: boolean }
interface RemovedPayload { userId: string }

/**
 * @param roomId   the UI room id (NOT namespaced — we add the vegga_ prefix here)
 * @param apply    provider.applyServerEvent
 * @param enabled  only subscribe while connected to voice
 */
export function useVoiceChannelEvents(
  roomId: string,
  apply: (e: ServerVoiceEvent) => void,
  enabled: boolean,
) {
  const ch = enabled ? channelName(`vegga_${roomId}`) : "";

  const onRole = useCallback((d: RolePayload) => apply({ kind: "role", userId: d.userId, role: d.role }), [apply]);
  const onJoined = useCallback((d: RolePayload) => apply({ kind: "joined", userId: d.userId, role: d.role }), [apply]);
  const onMuted = useCallback((d: MutedPayload) => apply({ kind: "muted", userId: d.userId, mutedByHost: d.mutedByHost }), [apply]);
  const onRemoved = useCallback((d: RemovedPayload) => apply({ kind: "removed", userId: d.userId }), [apply]);

  usePusher<RolePayload>(ch, "member:role", onRole);
  usePusher<RolePayload>(ch, "member:joined", onJoined);
  usePusher<MutedPayload>(ch, "member:muted", onMuted);
  usePusher<RemovedPayload>(ch, "member:removed", onRemoved);
}
