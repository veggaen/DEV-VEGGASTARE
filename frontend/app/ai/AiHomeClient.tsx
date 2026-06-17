"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import HeroParticleField from "@/components/uicustom/home/HeroParticleField";
import { HoverFollowGrid, HoverFollowItem } from "@/components/uicustom/HoverFollowGrid";

interface Session {
  id: string;
  title: string;
  isPublic: boolean;
  triggerMode: string;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

interface AiHomeClientProps {
  isLoggedIn: boolean;
  userId: string | null;
  userName: string | null;
}

/** Relative "time ago" that degrades to a date past a week — keeps the cards human. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AiHomeClient({ isLoggedIn, userId, userName }: AiHomeClientProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const loadSessions = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai-chat/sessions?limit=30");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      setError("Failed to load conversations.");
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleNewChat = useCallback(async () => {
    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/ai-chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/ai/${data.id}`);
      } else {
        setError("Failed to create conversation.");
        setCreating(false);
      }
    } catch {
      setError("Failed to create conversation.");
      setCreating(false);
    }
  }, [isLoggedIn, router]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      const res = await fetch(`/api/ai-chat/sessions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {}
  }, []);

  const startPrompt = useCallback(async (prompt: string) => {
    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/ai-chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: prompt.slice(0, 60) }),
      });
      if (res.ok) {
        const data = await res.json();
        // Seed the composer via query param; the conversation reads it on mount.
        router.push(`/ai/${data.id}?seed=${encodeURIComponent(prompt)}`);
      } else {
        setError("Failed to create conversation.");
        setCreating(false);
      }
    } catch {
      setError("Failed to create conversation.");
      setCreating(false);
    }
  }, [isLoggedIn, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  const firstName = userName?.split(" ")[0] ?? null;

  return (
    <main className="relative min-h-dvh flex flex-col bg-background overflow-hidden">
      {/* Edge-stars field — drifts along the left/right edges (brand accent),
          only a few crossing the clean centre. Blends seamlessly into the
          header because there's no hard divider over it. */}
      <HeroParticleField className="z-0" density={0.7} centerFade={0.06} />

      {/* Header — centered + open: shares the body's max-width gutter instead of
          pinning links to the far corners (no edge-to-edge reach on wide
          screens). No bottom border, so it melts into the starfield. */}
      <header className="relative z-10 w-full mx-auto max-w-3xl px-6 pt-5 pb-2 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="grid place-items-center h-7 w-7 rounded-full bg-black/5 dark:bg-white/8 group-hover:bg-black/10 dark:group-hover:bg-white/12 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </span>
          Home
        </Link>

        <motion.button
          onClick={handleNewChat}
          disabled={creating}
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-500/25"
        >
          {creating ? (
            <span className="h-4 w-4 rounded-full border-2 border-black/40 border-t-transparent animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
          New chat
        </motion.button>
      </header>

      {/* Body */}
      <div className="relative z-10 flex-1 w-full mx-auto max-w-3xl px-6 pb-10 pt-4">
        {!isLoggedIn ? (
          <AnonymousHero onCreate={handleNewChat} onPrompt={startPrompt} creating={creating} reduceMotion={!!reduceMotion} />
        ) : (
          <>
            {/* Editorial hero */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-500 dark:text-emerald-400">
                AI workspace
              </p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.05]">
                {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
              </h1>
              <p className="mt-2.5 text-[15px] text-muted-foreground max-w-md">
                Pick up a conversation, or start something new. Bring your own keys, add multiple AI participants, collaborate in real time.
              </p>
            </motion.div>

            {/* Starter prompts — one-click into a new chat */}
            {sessions.length === 0 && !loading && (
              <SuggestionDeck onPrompt={startPrompt} reduceMotion={!!reduceMotion} />
            )}

            {/* Conversations */}
            <div className="mt-10">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Conversations {sessions.length > 0 && <span className="text-foreground/30">· {sessions.length}</span>}
                </h2>
                {sessions.length > 4 && (
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="w-40 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/8 px-3 py-1.5 text-xs outline-none focus:border-emerald-500/40 transition-colors"
                  />
                )}
              </div>

              {error && (
                <div className="mb-4 text-sm text-red-500 dark:text-red-400 bg-red-500/10 rounded-xl px-4 py-3 border border-red-500/20">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-[68px] rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <EmptyState onCreate={handleNewChat} creating={creating} reduceMotion={!!reduceMotion} />
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No conversations match “{query}”.</p>
              ) : (
                <AnimatePresence initial={false}>
                  <HoverFollowGrid className="space-y-2.5" radiusClass="rounded-2xl">
                    {filtered.map((s, i) => (
                      <HoverFollowItem key={s.id}>
                      <motion.div
                        layout
                        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
                        transition={{ duration: 0.3, delay: reduceMotion ? 0 : Math.min(i * 0.03, 0.2) }}
                      >
                        <Link
                          href={`/ai/${s.id}`}
                          className="group relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-black/6 dark:border-white/8 bg-white/60 dark:bg-white/[0.03] hover:bg-white/90 dark:hover:bg-white/[0.06] transition-all duration-200"
                        >
                          {/* Avatar / spark */}
                          <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                            ✦
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[15px] font-medium truncate">{s.title}</p>
                              {s.isPublic && (
                                <span className="shrink-0 text-[10px] text-emerald-600 dark:text-emerald-400/70 border border-emerald-500/25 rounded-md px-1.5 py-0.5 leading-none">
                                  Public
                                </span>
                              )}
                              {s.isSuspended && (
                                <span className="shrink-0 text-[10px] text-red-500 border border-red-500/25 rounded-md px-1.5 py-0.5 leading-none">
                                  Suspended
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {s._count.messages} message{s._count.messages !== 1 ? "s" : ""} · {timeAgo(s.updatedAt)}
                            </p>
                          </div>

                          <svg
                            className="shrink-0 text-muted-foreground/40 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all"
                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            aria-hidden
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>

                          <button
                            onClick={(e) => handleDelete(s.id, e)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-background/80 hover:bg-red-500/15 text-muted-foreground hover:text-red-500 transition-all"
                            aria-label="Delete conversation"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                            </svg>
                          </button>
                        </Link>
                      </motion.div>
                      </HoverFollowItem>
                    ))}
                  </HoverFollowGrid>
                </AnimatePresence>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const STARTERS = [
  { icon: "✎", label: "Draft & rewrite", prompt: "Help me draft a clear, friendly product announcement." },
  { icon: "{ }", label: "Explain code", prompt: "Explain this code and suggest how to make it cleaner." },
  { icon: "◎", label: "Plan something", prompt: "Help me break a big goal into a concrete step-by-step plan." },
  { icon: "✦", label: "Brainstorm", prompt: "Brainstorm 10 creative ideas with me, then help me pick." },
];

function SuggestionDeck({ onPrompt, reduceMotion }: { onPrompt: (p: string) => void; reduceMotion: boolean }) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="mt-8"
    >
      <HoverFollowGrid className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" radiusClass="rounded-2xl">
        {STARTERS.map((s) => (
          <HoverFollowItem key={s.label}>
            <button
              onClick={() => onPrompt(s.prompt)}
              className="group flex w-full items-start gap-3 text-left px-4 py-3.5 rounded-2xl border border-black/6 dark:border-white/8 bg-white/60 dark:bg-white/[0.03] hover:bg-white/90 dark:hover:bg-white/[0.06] transition-all"
            >
              <span className="shrink-0 grid place-items-center h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 text-sm group-hover:scale-110 transition-transform">
                {s.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5 truncate">{s.prompt}</span>
              </span>
            </button>
          </HoverFollowItem>
        ))}
      </HoverFollowGrid>
    </motion.div>
  );
}

function EmptyState({ onCreate, creating, reduceMotion }: { onCreate: () => void; creating: boolean; reduceMotion: boolean }) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-4 py-12 text-center"
    >
      <div className="text-4xl text-emerald-500/30 dark:text-emerald-400/30">✦</div>
      <div>
        <p className="text-base font-medium">No conversations yet</p>
        <p className="text-sm text-muted-foreground mt-1">Try a starter above, or start fresh.</p>
      </div>
      <motion.button
        onClick={onCreate}
        disabled={creating}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        className="mt-1 px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20"
      >
        {creating ? "Creating…" : "Start your first chat"}
      </motion.button>
    </motion.div>
  );
}

function AnonymousHero({
  onCreate,
  onPrompt,
  creating,
  reduceMotion,
}: {
  onCreate: () => void;
  onPrompt: (p: string) => void;
  creating: boolean;
  reduceMotion: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center py-12">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="grid place-items-center h-16 w-16 rounded-2xl bg-emerald-500/10 text-3xl text-emerald-500 dark:text-emerald-400 mb-6"
      >
        ✦
      </motion.div>
      <motion.h1
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em]"
      >
        Answers, ideas, and code —<br className="hidden sm:block" /> in one conversation.
      </motion.h1>
      <motion.p
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.45 }}
        className="text-muted-foreground mt-3 max-w-md text-[15px]"
      >
        Chat with AI assistants. Sign in for history, bring-your-own-key support, and group AI chat.
      </motion.p>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26, duration: 0.45 }}
        className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mt-7"
      >
        <Link
          href="/auth/login"
          className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors text-center shadow-lg shadow-emerald-500/20"
        >
          Sign in
        </Link>
        <button
          onClick={onCreate}
          disabled={creating}
          className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/15 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          {creating ? "Starting…" : "Try anonymously"}
        </button>
      </motion.div>

      <div className="w-full mt-10">
        <SuggestionDeck onPrompt={onPrompt} reduceMotion={reduceMotion} />
      </div>
    </div>
  );
}
