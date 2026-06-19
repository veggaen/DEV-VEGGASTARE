/**
 * @fileOverview LiveKitVoiceProvider — the REAL voice backend, implementing the
 *   same VoiceProvider interface as the stub. It connects to a LiveKit room
 *   (token from /api/voice/token), publishes the local mic, and maps LiveKit's
 *   participant + track + active-speaker events onto our VoiceMember[] shape so
 *   the UI is identical to the stub.
 *
 *   It loads only when keys exist (the factory decides), and imports the SDK
 *   dynamically so it never weighs on the bundle for users who don't open voice.
 *   Raise-hand / promote / reactions ride LiveKit data messages + metadata.
 * @stability experimental
 */

import type {
  VoiceProvider,
  VoiceProviderConfig,
  VoiceRoomState,
  VoiceMember,
  VoiceRole,
  ServerVoiceEvent,
} from "./types";
import { readVoicePrefs } from "./voice-prefs";

type DbRole = "HOST" | "MODERATOR" | "SPEAKER" | "LISTENER";

/** Map a DB role (from the server) onto the UI's 3-way VoiceRole. */
function dbRoleToUi(role: DbRole): VoiceRole {
  if (role === "HOST" || role === "MODERATOR") return "host";
  if (role === "SPEAKER") return "speaker";
  return "listener";
}

// Minimal structural types to avoid importing the SDK at module load.
type LkRoom = {
  localParticipant: LkParticipant;
  remoteParticipants: Map<string, LkParticipant>;
  on: (ev: string, cb: (...a: unknown[]) => void) => void;
  disconnect: () => Promise<void>;
};
type LkParticipant = {
  identity: string;
  name?: string;
  isMicrophoneEnabled?: boolean;
  metadata?: string;
  permissions?: { canPublish?: boolean };
  setMicrophoneEnabled: (on: boolean, opts?: { deviceId?: string }) => Promise<void>;
};

interface HandMeta {
  handRaised?: boolean;
  handRaisedAt?: number | null;
  role?: VoiceRole;
  image?: string | null;
}

export class LiveKitVoiceProvider implements VoiceProvider {
  readonly isStub = false;

  private state: VoiceRoomState = { connection: "disconnected", members: [], selfId: null, error: null };
  private listeners = new Set<(s: VoiceRoomState) => void>();
  private cfg: VoiceProviderConfig;
  private room: LkRoom | null = null;
  private speaking = new Set<string>();
  /** Server-authoritative role per user (from the token + Pusher events). LiveKit's
   *  own metadata is optimistic; this overlay wins when present. */
  private serverRoles = new Map<string, DbRole>();
  /** Users a host has server-muted (overlaid onto the rendered muted flag). */
  private hostMuted = new Set<string>();

  constructor(cfg: VoiceProviderConfig) {
    this.cfg = cfg;
  }

  getState() { return this.state; }
  subscribe(l: (s: VoiceRoomState) => void) {
    this.listeners.add(l); l(this.state);
    return () => this.listeners.delete(l);
  }
  private set(p: Partial<VoiceRoomState>) {
    this.state = { ...this.state, ...p };
    this.listeners.forEach((l) => l(this.state));
  }

  async join() {
    if (this.state.connection === "connected" || this.state.connection === "connecting") return;
    this.set({ connection: "connecting", error: null });
    try {
      // Grants are derived server-side from membership — we no longer send isHost.
      const res = await fetch("/api/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: this.cfg.roomId }),
      });
      const data = await res.json();
      if (!data?.configured || !data.token) {
        throw new Error("LiveKit not configured");
      }

      const myRole: DbRole = (data.role as DbRole) ?? "LISTENER";
      this.serverRoles.set(this.cfg.self.id, myRole);

      const { Room, RoomEvent } = await import("livekit-client");
      const room = new Room({ adaptiveStream: true, dynacast: true }) as unknown as LkRoom;
      this.room = room;

      const rebuild = () => this.rebuildMembers();
      room.on(RoomEvent.ParticipantConnected, rebuild);
      room.on(RoomEvent.ParticipantDisconnected, rebuild);
      room.on(RoomEvent.TrackMuted, rebuild);
      room.on(RoomEvent.TrackUnmuted, rebuild);
      room.on(RoomEvent.ParticipantMetadataChanged, rebuild);
      room.on(RoomEvent.ParticipantPermissionsChanged, rebuild);
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: unknown) => {
        this.speaking = new Set((speakers as Array<{ identity: string }>).map((s) => s.identity));
        this.rebuildMembers();
      });
      // Reconnection is handled by the SDK; surface it so the UI can show state.
      room.on(RoomEvent.Reconnecting, () => this.set({ connection: "connecting" }));
      room.on(RoomEvent.Reconnected, () => {
        this.set({ connection: "connected" });
        this.rebuildMembers();
      });
      room.on(RoomEvent.Disconnected, () => {
        this.set({ connection: "disconnected", members: [], selfId: null });
      });

      await (room as unknown as { connect: (u: string, t: string) => Promise<void> }).connect(data.url, data.token);
      // Anyone the server granted publish opens the mic (host, moderator, speaker).
      if (canPublishDbRole(myRole)) {
        await this.enableMic(true);
      }
      this.set({ connection: "connected", selfId: room.localParticipant.identity });
      this.rebuildMembers();
    } catch (e) {
      this.set({ connection: "error", error: e instanceof Error ? e.message : "Failed to join voice" });
    }
  }

  /** Open/close the mic, honoring the user's device + noise-processing settings. */
  private async enableMic(on: boolean) {
    const p = readVoicePrefs();
    const opts = on
      ? {
          ...(p.micDeviceId ? { deviceId: p.micDeviceId } : {}),
          noiseSuppression: p.noiseSuppression,
          echoCancellation: p.echoCancellation,
          autoGainControl: p.autoGainControl,
        }
      : undefined;
    try {
      await this.room?.localParticipant.setMicrophoneEnabled(on, opts);
    } catch {
      /* mic denied or device unavailable — stays muted */
    }
  }

  async leave() {
    await this.room?.disconnect();
    this.room = null;
    this.set({ connection: "disconnected", members: [], selfId: null });
  }

  setMuted(muted: boolean) {
    void this.enableMic(!muted).then(() => this.rebuildMembers());
  }

  raiseHand(raised: boolean) {
    this.updateSelfMeta({ handRaised: raised, handRaisedAt: raised ? Date.now() : null });
  }

  // Host controls are OPTIMISTIC local echoes only. The authoritative change is
  // performed by the REST endpoint (useVoiceRoom), persisted, enforced on the SFU,
  // and broadcast back via applyServerEvent — which is what actually sticks.
  promote(memberId: string) { this.optimisticRole(memberId, "SPEAKER"); }
  demote(memberId: string) { this.optimisticRole(memberId, "LISTENER"); }
  muteMember(memberId: string) { this.hostMuted.add(memberId); this.rebuildMembers(); }
  removeMember(memberId: string) {
    this.set({ members: this.state.members.filter((m) => m.id !== memberId) });
  }

  private optimisticRole(memberId: string, role: DbRole) {
    this.serverRoles.set(memberId, role);
    this.rebuildMembers();
  }

  /** Apply a server-authoritative event (delivered via Pusher) to local state. */
  applyServerEvent(event: ServerVoiceEvent) {
    switch (event.kind) {
      case "joined":
      case "role": {
        this.serverRoles.set(event.userId, event.role);
        // If *I* was just granted a publishing role, open my mic.
        if (event.userId === this.cfg.self.id && canPublishDbRole(event.role)) {
          void this.enableMic(true).then(() => this.rebuildMembers());
        }
        // If *I* was demoted to listener, the SFU revokes publish; close the mic.
        if (event.userId === this.cfg.self.id && !canPublishDbRole(event.role)) {
          void this.enableMic(false).then(() => this.rebuildMembers());
        }
        break;
      }
      case "muted": {
        if (event.mutedByHost) this.hostMuted.add(event.userId);
        else this.hostMuted.delete(event.userId);
        // A host muting me closes my mic locally too.
        if (event.userId === this.cfg.self.id && event.mutedByHost) {
          void this.enableMic(false);
        }
        break;
      }
      case "removed": {
        this.serverRoles.delete(event.userId);
        this.hostMuted.delete(event.userId);
        if (event.userId === this.cfg.self.id) {
          void this.leave();
          return;
        }
        break;
      }
    }
    this.rebuildMembers();
  }

  private async updateSelfMeta(patch: HandMeta) {
    const lp = this.room?.localParticipant as unknown as {
      metadata?: string;
      setMetadata?: (m: string) => Promise<void>;
    };
    if (!lp?.setMetadata) return;
    const cur: HandMeta = lp.metadata ? safeParse(lp.metadata) : {};
    await lp.setMetadata(JSON.stringify({ ...cur, ...patch }));
    this.rebuildMembers();
  }

  private rebuildMembers() {
    if (!this.room) return;
    const all: LkParticipant[] = [this.room.localParticipant, ...this.room.remoteParticipants.values()];
    const members: VoiceMember[] = all.map((p) => {
      const meta: HandMeta = p.metadata ? safeParse(p.metadata) : {};
      const isSelf = p.identity === this.room!.localParticipant.identity;
      // Server role (authoritative) wins; fall back to metadata, then a heuristic.
      const dbRole = this.serverRoles.get(p.identity);
      const role: VoiceRole = dbRole
        ? dbRoleToUi(dbRole)
        : meta.role ?? (p.isMicrophoneEnabled ? "speaker" : "listener");
      return {
        id: p.identity,
        name: p.name || (isSelf ? this.cfg.self.name : "Member"),
        image: meta.image ?? (isSelf ? this.cfg.self.image : null),
        role,
        speaking: this.speaking.has(p.identity),
        muted: !p.isMicrophoneEnabled || this.hostMuted.has(p.identity),
        handRaised: !!meta.handRaised,
        handRaisedAt: meta.handRaisedAt ?? null,
      };
    });
    this.set({ members });
  }
}

/** Whether a DB role is permitted to publish audio. Mirrors the server. */
function canPublishDbRole(role: DbRole): boolean {
  return role === "HOST" || role === "MODERATOR" || role === "SPEAKER";
}

function safeParse(s: string): HandMeta {
  try { return JSON.parse(s) as HandMeta; } catch { return {}; }
}
