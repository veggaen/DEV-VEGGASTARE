/**
 * @fileOverview StubVoiceProvider — a fully-functional local fake of a voice
 *   channel so the entire UI works in demo mode without LiveKit/Deepgram keys.
 *
 *   It does real things where cheap and honest:
 *     - actually requests the mic via getUserMedia and runs a Web Audio analyser,
 *       so the local "speaking" indicator + mute genuinely reflect your voice;
 *     - models join/leave, raise-hand queue, and host promote/demote/kick on
 *       seeded mock members (with light simulated speaking) so hosts can drive
 *       the controls and see the UI respond.
 *
 *   Swapping in LiveKit later = implementing the same VoiceProvider interface;
 *   the UI doesn't change. See [[voice-architecture-decision]].
 * @stability experimental
 */

import type {
  VoiceProvider,
  VoiceProviderConfig,
  VoiceRoomState,
  VoiceMember,
} from "./types";

export class StubVoiceProvider implements VoiceProvider {
  readonly isStub = true;

  private state: VoiceRoomState = {
    connection: "disconnected",
    members: [],
    selfId: null,
    error: null,
  };
  private listeners = new Set<(s: VoiceRoomState) => void>();
  private cfg: VoiceProviderConfig;

  private micStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId = 0;
  private simTimer: ReturnType<typeof setInterval> | null = null;

  constructor(cfg: VoiceProviderConfig) {
    this.cfg = cfg;
  }

  getState() {
    return this.state;
  }

  subscribe(listener: (s: VoiceRoomState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<VoiceRoomState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private patchMember(id: string, patch: Partial<VoiceMember>) {
    this.set({
      members: this.state.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  }

  async join() {
    if (this.state.connection === "connected" || this.state.connection === "connecting") return;
    this.set({ connection: "connecting", error: null });

    // The local participant — host if they own the channel, else listener.
    const self: VoiceMember = {
      id: this.cfg.self.id,
      name: this.cfg.self.name,
      image: this.cfg.self.image,
      role: this.cfg.isHost ? "host" : "listener",
      speaking: false,
      muted: false,
      handRaised: false,
      handRaisedAt: null,
    };

    // Seeded mock members (e.g. other participants) as listeners/speakers.
    const seeded: VoiceMember[] = (this.cfg.seedMembers ?? [])
      .filter((m) => m.id !== self.id)
      .map((m) => ({
        ...m,
        speaking: false,
        muted: false,
        handRaised: false,
        handRaisedAt: null,
      }));

    try {
      // Real mic so the local speaking ring + mute are genuine.
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.startAnalyser();
    } catch {
      // Mic denied — still "connected", just can't transmit (muted).
      self.muted = true;
    }

    this.set({
      connection: "connected",
      selfId: self.id,
      members: [self, ...seeded],
    });

    this.startSimulation();
  }

  async leave() {
    this.stopAnalyser();
    this.stopSimulation();
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    this.set({ connection: "disconnected", members: [], selfId: null });
  }

  setMuted(muted: boolean) {
    if (!this.state.selfId) return;
    this.micStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.patchMember(this.state.selfId, { muted, speaking: muted ? false : this.state.members.find((m) => m.id === this.state.selfId)?.speaking ?? false });
  }

  raiseHand(raised: boolean) {
    if (!this.state.selfId) return;
    this.patchMember(this.state.selfId, {
      handRaised: raised,
      handRaisedAt: raised ? Date.now() : null,
    });
  }

  promote(memberId: string) {
    if (!this.cfg.isHost) return;
    this.patchMember(memberId, { role: "speaker", handRaised: false, handRaisedAt: null });
  }

  demote(memberId: string) {
    if (!this.cfg.isHost) return;
    this.patchMember(memberId, { role: "listener", speaking: false });
  }

  muteMember(memberId: string) {
    if (!this.cfg.isHost) return;
    this.patchMember(memberId, { muted: true, speaking: false });
  }

  removeMember(memberId: string) {
    if (!this.cfg.isHost) return;
    this.set({ members: this.state.members.filter((m) => m.id !== memberId) });
  }

  // ── Local mic analyser → genuine "speaking" for the local user ──
  private startAnalyser() {
    if (!this.micStream) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new Ctx();
    const src = this.audioCtx.createMediaStreamSource(this.micStream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    src.connect(this.analyser);
    const data = new Uint8Array(this.analyser.frequencyBinCount);

    const tick = () => {
      if (!this.analyser || !this.state.selfId) return;
      this.analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      const self = this.state.members.find((m) => m.id === this.state.selfId);
      const speaking = !self?.muted && avg > 18; // threshold
      if (self && self.speaking !== speaking) {
        this.patchMember(this.state.selfId, { speaking });
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopAnalyser() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    void this.audioCtx?.close();
    this.audioCtx = null;
    this.analyser = null;
  }

  // ── Light simulation so mock speakers occasionally "talk" ──
  private startSimulation() {
    this.simTimer = setInterval(() => {
      const speakers = this.state.members.filter(
        (m) => m.id !== this.state.selfId && (m.role === "speaker" || m.role === "host") && !m.muted,
      );
      if (speakers.length === 0) return;
      const pick = speakers[Math.floor(Math.random() * speakers.length)];
      this.patchMember(pick.id, { speaking: true });
      setTimeout(() => this.patchMember(pick.id, { speaking: false }), 900 + Math.random() * 1400);
    }, 2600);
  }

  private stopSimulation() {
    if (this.simTimer) clearInterval(this.simTimer);
    this.simTimer = null;
  }
}
