"use client";

/**
 * @fileOverview ChatSidebar — the shared right rail for both AI (/ai/[id]) and DM
 *   (/conversations/[id]) chats. Two stacked sections in the app's open, glassy
 *   landing language (no nested chrome boxes):
 *
 *     1. Voice channel — a Discord/X-Spaces hybrid: join the channel, see active
 *        speakers on a "stage" with pulsing speaking rings, listeners below,
 *        raise-hand queue, and host controls (promote/demote/mute/remove). Wired
 *        to the pluggable voice layer (stub today, LiveKit later).
 *     2. Members — roster with role badges; hovering a member smoothly reveals
 *        per-member actions (the nested hover-expand interaction).
 *
 *   See [[voice-architecture-decision]].
 * @stability experimental
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  FiAlertTriangle, FiMic, FiMicOff, FiPhoneOff, FiHeadphones, FiChevronRight, FiSettings, FiShield, FiUserX, FiRefreshCw,
} from "react-icons/fi";
import { cn } from "@/lib/utils";
import { useVoiceRoom } from "@/lib/voice/useVoiceRoom";
import { useVoiceChannelEvents } from "@/lib/voice/useVoiceChannelEvents";
import type { VoiceMember, VoiceRole } from "@/lib/voice/types";
import { readVoicePrefs, useVoicePrefs } from "@/lib/voice/voice-prefs";
import { describeCurrentMediaError, enumerateAudioDevices, openMicrophoneStream } from "@/lib/voice/media-devices";
import { VoiceSettingsModal } from "./VoiceSettingsModal";
import { ThemedSelect, type SelectOption } from "./ThemedSelect";

export interface SidebarMember {
  id: string;
  name: string;
  image: string | null;
  /** Chat-level role label (Owner / Admin / Member / AI). */
  label?: string;
  isAi?: boolean;
}

interface ChatSidebarProps {
  roomId: string;
  self: { id: string; name: string; image: string | null };
  isHost: boolean;
  members: SidebarMember[];
  /** Section heading for the roster (e.g. "Participants"). */
  membersTitle?: string;
  className?: string;
}

const ROLE_BADGE: Record<VoiceRole, { label: string; cls: string }> = {
  host: { label: "Host", cls: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  speaker: { label: "Speaker", cls: "text-sky-600 dark:text-sky-400 border-sky-500/30" },
  listener: { label: "", cls: "" },
};

function initials(name: string) {
  return name?.trim()?.[0]?.toUpperCase() ?? "?";
}

export function ChatSidebar({
  roomId,
  self,
  isHost,
  members,
  membersTitle = "Members",
  className,
}: ChatSidebarProps) {
  const reduceMotion = useReducedMotion();
  const voice = useVoiceRoom({
    roomId,
    self,
    isHost,
    seedMembers: members
      .filter((m) => !m.isAi)
      .map((m) => ({ id: m.id, name: m.name, image: m.image, role: "listener" as VoiceRole })),
  });

  const connected = voice.connection === "connected";
  // Live role/mute/remove from the server (host actions by anyone) → local state.
  useVoiceChannelEvents(roomId, voice.applyServerEvent, connected);

  const speakers = voice.members.filter((m) => m.role === "host" || m.role === "speaker");
  const listeners = voice.members.filter((m) => m.role === "listener");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [joinNotice, setJoinNotice] = React.useState<string | null>(null);
  const [joinRequesting, setJoinRequesting] = React.useState(false);
  const [voiceMics, setVoiceMics] = React.useState<MediaDeviceInfo[]>([]);
  const { prefs, update: updateVoicePrefs } = useVoicePrefs();
  const canManageVoice = isHost || voice.self?.role === "host";
  const canRaiseHand = voice.self?.role === "listener" && !canManageVoice;

  const loadVoiceDevices = React.useCallback(async () => {
    try {
      const devices = await enumerateAudioDevices();
      setVoiceMics(devices.inputs);
    } catch {
      setVoiceMics([]);
    }
  }, []);

  React.useEffect(() => {
    void loadVoiceDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", loadVoiceDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", loadVoiceDevices);
  }, [loadVoiceDevices]);

  React.useEffect(() => {
    if (settingsOpen || connected) void loadVoiceDevices();
  }, [connected, loadVoiceDevices, settingsOpen]);

  const handleJoinVoice = React.useCallback(async () => {
    if (joinRequesting || voice.connection === "connecting") return;
    setJoinRequesting(true);
    setJoinNotice(null);
    try {
      const stream = await openMicrophoneStream(readVoicePrefs());
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      setJoinNotice(await describeCurrentMediaError(err));
      setSettingsOpen(true);
      setJoinRequesting(false);
      return;
    }
    try {
      await voice.join();
    } finally {
      setJoinRequesting(false);
    }
  }, [joinRequesting, voice]);

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      <VoiceSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {/* ── Voice channel ── */}
      <section className="px-4 pt-4 pb-3 border-b border-black/5 dark:border-white/8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
            <FiHeadphones className="h-3.5 w-3.5" /> Voice
          </h3>
          <div className="flex items-center gap-1.5">
            {voice.isStub && (
              <span className="text-[9px] text-muted-foreground/60 border border-black/5 dark:border-white/10 rounded px-1.5 py-0.5">
                Preview
              </span>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Voice settings"
              title="Voice settings"
              className="grid place-items-center h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:rotate-45 active:scale-90"
            >
              <FiSettings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {(voiceMics.length > 0 || prefs.micDeviceId) && (
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
            <ThemedSelect
              ariaLabel="Voice microphone"
              options={toVoiceDeviceOptions(voiceMics)}
              value={prefs.micDeviceId}
              onChange={(value) => {
                updateVoicePrefs({ micDeviceId: value });
                setJoinNotice(null);
              }}
            />
            <button
              onClick={() => void loadVoiceDevices()}
              className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:border-white/12 dark:hover:bg-white/8"
              aria-label="Refresh microphones"
              title="Refresh microphones"
            >
              <FiRefreshCw className="h-4 w-4" />
            </button>
          </div>
        )}

        {!connected ? (
          <>
          <button
            onClick={handleJoinVoice}
            disabled={voice.connection === "connecting" || joinRequesting}
            className="group w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
          >
            <FiMic className="h-4 w-4 transition-transform group-hover:scale-110" />
            {joinRequesting ? "Opening mic..." : voice.connection === "connecting" ? "Joining..." : "Join voice"}
          </button>
          {(joinNotice || voice.error) && (
            <VoiceNotice message={joinNotice ?? voice.error ?? ""} onSettings={() => setSettingsOpen(true)} />
          )}
          </>
        ) : (
          <div className="space-y-3">
            {voice.error && <VoiceNotice message={voice.error} onSettings={() => setSettingsOpen(true)} compact />}
            {/* Speaker stage */}
            <div className="grid grid-cols-3 gap-2">
              {speakers.map((m) => (
                <VoiceAvatar key={m.id} m={m} reduceMotion={!!reduceMotion} large />
              ))}
            </div>

            {/* Listeners */}
            {listeners.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {listeners.map((m) => (
                  <VoiceAvatar key={m.id} m={m} reduceMotion={!!reduceMotion} />
                ))}
              </div>
            )}

            {/* Host: raise-hand queue */}
            {canManageVoice && voice.raisedHands.length > 0 && (
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-2 space-y-1">
                <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider px-1">
                  Raised hands · {voice.raisedHands.length}
                </p>
                {voice.raisedHands.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 px-1 py-0.5">
                    <span className="text-xs truncate">{m.name}</span>
                    <button
                      onClick={() => voice.promote(m.id)}
                      className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                    >
                      Bring up
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom controls */}
            <div className="flex items-center gap-1.5 pt-1">
              <ControlButton
                active={!voice.self?.muted}
                onClick={voice.toggleMute}
                label={voice.self?.muted ? "Unmute" : "Mute"}
              >
                {voice.self?.muted ? <FiMicOff className="h-4 w-4" /> : <FiMic className="h-4 w-4" />}
              </ControlButton>
              {canRaiseHand && (
                <ControlButton
                  active={!!voice.self?.handRaised}
                  onClick={voice.toggleHand}
                  label="Raise hand"
                >
                  <span className="text-base leading-none">✋</span>
                </ControlButton>
              )}
              <button
                onClick={voice.leave}
                className="ml-auto grid place-items-center h-9 w-9 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                aria-label="Leave voice"
                title="Leave voice"
              >
                <FiPhoneOff className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Members roster ── */}
      <section className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        <h3 className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {membersTitle} · {members.length}
        </h3>
        <div className="space-y-0.5">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              canManage={canManageVoice && m.id !== self.id && !m.isAi}
              reduceMotion={!!reduceMotion}
              onMute={() => voice.muteMember(m.id)}
              onMakeModerator={() => voice.makeModerator(m.id)}
              onRemove={() => voice.removeMember(m.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/** Avatar with a pulsing accent ring while the member is speaking. */
function VoiceAvatar({ m, reduceMotion, large }: { m: VoiceMember; reduceMotion: boolean; large?: boolean }) {
  const size = large ? "h-12 w-12" : "h-8 w-8";
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div className="relative">
        {/* Speaking glow aura — soft pulsing emerald halo behind the avatar */}
        {m.speaking && !reduceMotion && (
          <motion.span
            aria-hidden
            className="absolute -inset-1.5 rounded-full bg-emerald-400/40 blur-md"
            initial={{ opacity: 0.4, scale: 0.9 }}
            animate={{ opacity: [0.4, 0.75, 0.4], scale: [0.9, 1.12, 0.9] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <div
          className={cn(
            "relative grid place-items-center rounded-full overflow-hidden bg-linear-to-br from-indigo-500 to-purple-600 text-white font-medium transition-all duration-200",
            size,
            m.speaking && "ring-2 ring-emerald-400 ring-offset-2 ring-offset-background",
          )}
        >
          {m.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.image} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(m.name)
          )}
        </div>
        {/* Expanding ripple ring while speaking */}
        {m.speaking && !reduceMotion && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-emerald-400"
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        {m.muted && (
          <span className="absolute -bottom-0.5 -right-0.5 grid place-items-center h-4 w-4 rounded-full bg-background text-red-500 ring-2 ring-background">
            <FiMicOff className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      {large && (
        <span className={cn("text-[10px] truncate max-w-full transition-colors", m.speaking ? "text-emerald-500 dark:text-emerald-400 font-medium" : "text-muted-foreground")}>
          {m.name.split(" ")[0]}
        </span>
      )}
    </div>
  );
}

function ControlButton({
  active, onClick, label, children,
}: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.06 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      className={cn(
        "grid place-items-center h-9 w-9 rounded-full transition-colors",
        active
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-black/5 dark:bg-white/8 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </motion.button>
  );
}

function VoiceNotice({
  message,
  onSettings,
  compact = false,
}: {
  message: string;
  onSettings: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300",
        compact ? "px-2.5 py-2" : "mt-2 px-3 py-2.5",
      )}
    >
      <div className="flex items-start gap-2">
        <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p className="min-w-0 flex-1 text-[11px] leading-snug">{message}</p>
      </div>
      <button
        onClick={onSettings}
        className="mt-2 rounded-md bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-amber-500/25"
      >
        Open settings
      </button>
    </div>
  );
}

function toVoiceDeviceOptions(devices: MediaDeviceInfo[]): SelectOption[] {
  const seen = new Set<string>(["", "default"]);
  return [
    { value: "", label: "System default mic" },
    ...devices
      .filter((device) => {
        if (!device.deviceId || seen.has(device.deviceId)) return false;
        seen.add(device.deviceId);
        return true;
      })
      .map((device, index) => ({
        value: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
      })),
  ];
}

/** Roster row: hover reveals actions; right-click opens the same host controls. */
function MemberRow({
  member, canManage, reduceMotion, onMute, onMakeModerator, onRemove,
}: {
  member: SidebarMember;
  canManage: boolean;
  reduceMotion: boolean;
  onMute: () => void;
  onMakeModerator: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "mod" | "remove">(null);
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null);

  const run = async (which: "mod" | "remove", fn: () => void) => {
    setBusy(which);
    try { await fn(); } finally { setBusy(null); }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (!canManage) return; // only hosts get the menu; default menu otherwise
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onContextMenu={onContextMenu}
      className="group rounded-lg overflow-hidden hover:bg-black/4 dark:hover:bg-white/5 transition-colors"
    >
      {menu && (
        <MemberContextMenu
          x={menu.x}
          y={menu.y}
          name={member.name}
          onClose={() => setMenu(null)}
          onMute={onMute}
          onMakeModerator={onMakeModerator}
          onRemove={onRemove}
        />
      )}
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <div className="relative shrink-0">
          <div className={cn(
            "grid place-items-center h-8 w-8 rounded-full text-xs font-medium text-white",
            member.isAi ? "bg-emerald-500/80" : "bg-linear-to-br from-indigo-500 to-purple-600",
          )}>
            {member.isAi ? "✦" : initials(member.name)}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm truncate">{member.name}</p>
        </div>
        {member.label && (
          <span className="shrink-0 text-[10px] text-muted-foreground border border-black/5 dark:border-white/10 rounded px-1.5 py-0.5 leading-none">
            {member.label}
          </span>
        )}
        {canManage && (
          <FiChevronRight
            className={cn("shrink-0 h-4 w-4 text-muted-foreground/40 transition-transform", open && "rotate-90")}
          />
        )}
      </div>

      {/* Hover-reveal host actions */}
      {canManage && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-1.5 px-2 pb-2 pl-[2.625rem]">
                <button
                  onClick={() => run("mod", onMakeModerator)}
                  disabled={busy !== null}
                  className="text-[11px] px-2 py-1 rounded-md bg-black/5 dark:bg-white/8 hover:bg-black/10 dark:hover:bg-white/12 transition-colors disabled:opacity-50"
                >
                  {busy === "mod" ? "Making…" : "Make moderator"}
                </button>
                <button
                  onClick={() => run("remove", onRemove)}
                  disabled={busy !== null}
                  className="text-[11px] px-2 py-1 rounded-md text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {busy === "remove" ? "Removing…" : "Remove"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/** Discord-style right-click menu for a member, positioned at the cursor. */
function MemberContextMenu({
  x, y, name, onClose, onMute, onMakeModerator, onRemove,
}: {
  x: number;
  y: number;
  name: string;
  onClose: () => void;
  onMute: () => void;
  onMakeModerator: () => void;
  onRemove: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  // Keep the menu on-screen (flip if it would overflow the viewport edges).
  const W = 176, H = 132;
  const left = typeof window !== "undefined" ? Math.min(x, window.innerWidth - W - 8) : x;
  const top = typeof window !== "undefined" ? Math.min(y, window.innerHeight - H - 8) : y;

  const act = (fn: () => void) => { fn(); onClose(); };

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left, top }}
      className="fixed z-[80] w-44 rounded-xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#15181e]/97 backdrop-blur-md shadow-2xl p-1"
    >
      <div className="px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground truncate border-b border-black/5 dark:border-white/8 mb-1">
        {name}
      </div>
      <button
        onClick={() => act(onMute)}
        className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
      >
        <FiMicOff className="h-3.5 w-3.5 text-muted-foreground" /> Mute
      </button>
      <button
        onClick={() => act(onMakeModerator)}
        className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
      >
        <FiShield className="h-3.5 w-3.5 text-muted-foreground" /> Make moderator
      </button>
      <button
        onClick={() => act(onRemove)}
        className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
      >
        <FiUserX className="h-3.5 w-3.5" /> Remove from channel
      </button>
    </div>
  );
}
