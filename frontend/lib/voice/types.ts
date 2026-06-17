/**
 * @fileOverview Voice provider abstraction — the seam between the UI and whatever
 *   real-time audio backend powers voice channels. The UI (ChatSidebar voice
 *   panel, room controls) binds ONLY to these types, never to a vendor SDK, so we
 *   can ship the full experience now against a stub and drop in LiveKit later by
 *   implementing this one interface. See [[voice-architecture-decision]].
 * @stability experimental
 */

export type VoiceRole = "host" | "speaker" | "listener";

export interface VoiceMember {
  id: string;
  name: string;
  image: string | null;
  role: VoiceRole;
  /** Currently transmitting audio (drives the speaking ring). */
  speaking: boolean;
  /** Self- or host-muted. */
  muted: boolean;
  /** Listener has requested to speak; hosts see a queue. */
  handRaised: boolean;
  /** When the hand was raised (for ordering the queue). */
  handRaisedAt: number | null;
}

export type VoiceConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface VoiceRoomState {
  connection: VoiceConnectionState;
  /** Everyone currently in the voice channel. */
  members: VoiceMember[];
  /** The local participant's id, once connected. */
  selfId: string | null;
  error: string | null;
}

/**
 * The actions the UI can invoke. A real provider (LiveKit) fulfils these against
 * the SFU + a data channel; the stub fakes them locally so the UI is fully
 * exercisable in demo mode.
 */
export interface VoiceProvider {
  getState(): VoiceRoomState;
  subscribe(listener: (state: VoiceRoomState) => void): () => void;

  join(): Promise<void>;
  leave(): Promise<void>;
  setMuted(muted: boolean): void;
  raiseHand(raised: boolean): void;

  // Host-only controls (no-op / rejected for non-hosts in a real provider).
  promote(memberId: string): void;
  demote(memberId: string): void;
  muteMember(memberId: string): void;
  removeMember(memberId: string): void;

  /** Whether this provider is talking to real infra or just mocking. */
  readonly isStub: boolean;
}

export interface VoiceProviderConfig {
  roomId: string;
  self: { id: string; name: string; image: string | null };
  /** The local user owns/admins the channel → gets host controls. */
  isHost: boolean;
  /** Seed members (e.g. text-chat participants shown as listeners). */
  seedMembers?: Array<Pick<VoiceMember, "id" | "name" | "image" | "role">>;
}
