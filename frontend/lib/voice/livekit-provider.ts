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
} from "./types";

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
  setMicrophoneEnabled: (on: boolean) => Promise<void>;
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
      const res = await fetch("/api/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: this.cfg.roomId, isHost: this.cfg.isHost }),
      });
      const data = await res.json();
      if (!data?.configured || !data.token) {
        throw new Error("LiveKit not configured");
      }

      const { Room, RoomEvent } = await import("livekit-client");
      const room = new Room({ adaptiveStream: true, dynacast: true }) as unknown as LkRoom;
      this.room = room;

      const rebuild = () => this.rebuildMembers();
      room.on(RoomEvent.ParticipantConnected, rebuild);
      room.on(RoomEvent.ParticipantDisconnected, rebuild);
      room.on(RoomEvent.TrackMuted, rebuild);
      room.on(RoomEvent.TrackUnmuted, rebuild);
      room.on(RoomEvent.ParticipantMetadataChanged, rebuild);
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: unknown) => {
        this.speaking = new Set((speakers as Array<{ identity: string }>).map((s) => s.identity));
        this.rebuildMembers();
      });
      room.on(RoomEvent.Disconnected, () => {
        this.set({ connection: "disconnected", members: [], selfId: null });
      });

      await (room as unknown as { connect: (u: string, t: string) => Promise<void> }).connect(data.url, data.token);
      // Host (or anyone with publish) opens the mic.
      if (this.cfg.isHost) {
        try { await room.localParticipant.setMicrophoneEnabled(true); } catch { /* mic denied */ }
      }
      this.set({ connection: "connected", selfId: room.localParticipant.identity });
      this.rebuildMembers();
    } catch (e) {
      this.set({ connection: "error", error: e instanceof Error ? e.message : "Failed to join voice" });
    }
  }

  async leave() {
    await this.room?.disconnect();
    this.room = null;
    this.set({ connection: "disconnected", members: [], selfId: null });
  }

  setMuted(muted: boolean) {
    void this.room?.localParticipant.setMicrophoneEnabled(!muted).then(() => this.rebuildMembers());
  }

  raiseHand(raised: boolean) {
    this.updateSelfMeta({ handRaised: raised, handRaisedAt: raised ? Date.now() : null });
  }

  // Host controls — promote/demote adjust target metadata; a server-side pass
  // (updateParticipant) grants/revokes publish. Mute/remove call room admin.
  promote(memberId: string) { this.signal("promote", memberId); }
  demote(memberId: string) { this.signal("demote", memberId); }
  muteMember(memberId: string) { this.signal("mute", memberId); }
  removeMember(memberId: string) { this.signal("remove", memberId); }

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

  private async signal(action: string, target: string) {
    // Send a data message hosts' clients / a server agent act on. Implemented
    // fully when the room agent lands; the metadata path covers raise-hand now.
    const lp = this.room?.localParticipant as unknown as {
      publishData?: (d: Uint8Array, o?: unknown) => Promise<void>;
    };
    if (!lp?.publishData) return;
    const payload = new TextEncoder().encode(JSON.stringify({ action, target }));
    await lp.publishData(payload, { reliable: true });
  }

  private rebuildMembers() {
    if (!this.room) return;
    const all: LkParticipant[] = [this.room.localParticipant, ...this.room.remoteParticipants.values()];
    const members: VoiceMember[] = all.map((p) => {
      const meta: HandMeta = p.metadata ? safeParse(p.metadata) : {};
      const isSelf = p.identity === this.room!.localParticipant.identity;
      const role: VoiceRole =
        meta.role ?? (isSelf && this.cfg.isHost ? "host" : (p.isMicrophoneEnabled ? "speaker" : "listener"));
      return {
        id: p.identity,
        name: p.name || (isSelf ? this.cfg.self.name : "Member"),
        image: meta.image ?? (isSelf ? this.cfg.self.image : null),
        role,
        speaking: this.speaking.has(p.identity),
        muted: !p.isMicrophoneEnabled,
        handRaised: !!meta.handRaised,
        handRaisedAt: meta.handRaisedAt ?? null,
      };
    });
    this.set({ members });
  }
}

function safeParse(s: string): HandMeta {
  try { return JSON.parse(s) as HandMeta; } catch { return {}; }
}
