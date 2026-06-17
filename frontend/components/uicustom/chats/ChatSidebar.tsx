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
  FiMic, FiMicOff, FiPhoneOff, FiHeadphones, FiChevronRight,
} from "react-icons/fi";
import { cn } from "@/lib/utils";
import { useVoiceRoom } from "@/lib/voice/useVoiceRoom";
import type { VoiceMember, VoiceRole } from "@/lib/voice/types";

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
  const speakers = voice.members.filter((m) => m.role === "host" || m.role === "speaker");
  const listeners = voice.members.filter((m) => m.role === "listener");

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      {/* ── Voice channel ── */}
      <section className="px-4 pt-4 pb-3 border-b border-black/5 dark:border-white/8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
            <FiHeadphones className="h-3.5 w-3.5" /> Voice
          </h3>
          {voice.isStub && (
            <span className="text-[9px] text-muted-foreground/60 border border-black/5 dark:border-white/10 rounded px-1.5 py-0.5">
              Preview
            </span>
          )}
        </div>

        {!connected ? (
          <button
            onClick={voice.join}
            disabled={voice.connection === "connecting"}
            className="group w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
          >
            <FiMic className="h-4 w-4 transition-transform group-hover:scale-110" />
            {voice.connection === "connecting" ? "Joining…" : "Join voice"}
          </button>
        ) : (
          <div className="space-y-3">
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
            {isHost && voice.raisedHands.length > 0 && (
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
              {!isHost && (
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
              canManage={isHost && m.id !== self.id && !m.isAi}
              reduceMotion={!!reduceMotion}
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
        <div
          className={cn(
            "grid place-items-center rounded-full overflow-hidden bg-linear-to-br from-indigo-500 to-purple-600 text-white font-medium transition-shadow",
            size,
            m.speaking && "shadow-[0_0_0_3px_rgba(52,211,153,0.6)]",
          )}
        >
          {m.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.image} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(m.name)
          )}
        </div>
        {m.speaking && !reduceMotion && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-emerald-400"
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        {m.muted && (
          <span className="absolute -bottom-0.5 -right-0.5 grid place-items-center h-4 w-4 rounded-full bg-background text-red-500">
            <FiMicOff className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      {large && (
        <span className="text-[10px] text-muted-foreground truncate max-w-full">{m.name.split(" ")[0]}</span>
      )}
    </div>
  );
}

function ControlButton({
  active, onClick, label, children,
}: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid place-items-center h-9 w-9 rounded-full transition-colors",
        active
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-black/5 dark:bg-white/8 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Roster row — hovering reveals per-member actions (nested hover-expand). */
function MemberRow({
  member, canManage, reduceMotion,
}: { member: SidebarMember; canManage: boolean; reduceMotion: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="group rounded-lg overflow-hidden hover:bg-black/4 dark:hover:bg-white/5 transition-colors"
    >
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
                <button className="text-[11px] px-2 py-1 rounded-md bg-black/5 dark:bg-white/8 hover:bg-black/10 dark:hover:bg-white/12 transition-colors">
                  Make moderator
                </button>
                <button className="text-[11px] px-2 py-1 rounded-md text-red-500 hover:bg-red-500/10 transition-colors">
                  Remove
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
