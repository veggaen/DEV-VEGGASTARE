"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

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

export default function AiHomeClient({ isLoggedIn, userId, userName }: AiHomeClientProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="min-h-dvh flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            ← Home
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-sm font-semibold flex items-center gap-2">
            <span className="text-emerald-400">✦</span> AI Chat
          </span>
        </div>

        <button
          onClick={handleNewChat}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {creating ? (
            <span className="h-4 w-4 rounded-full border-2 border-black/40 border-t-transparent animate-spin" />
          ) : (
            <span>+</span>
          )}
          New Chat
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-6 py-8">
        {!isLoggedIn ? (
          <AnonymousHero onCreate={handleNewChat} creating={creating} />
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-4">Your conversations</h2>

            {error && (
              <div className="mb-4 text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3 border border-red-500/20">
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <EmptyState onCreate={handleNewChat} creating={creating} />
            ) : (
              <AnimatePresence initial={false}>
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Link
                        href={`/ai/${s.id}`}
                        className="group flex items-center justify-between px-4 py-3 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-emerald-400/60 group-hover:text-emerald-400 transition-colors">✦</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{s.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {s._count.messages} message{s._count.messages !== 1 ? "s" : ""} ·{" "}
                              {new Date(s.updatedAt).toLocaleDateString()}
                              {s.isSuspended && (
                                <span className="ml-2 text-red-400">Suspended</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {s.isPublic && (
                            <span className="text-[10px] text-emerald-400/60 border border-emerald-500/20 rounded px-1.5 py-0.5">
                              Public
                            </span>
                          )}
                          <button
                            onClick={(e) => handleDelete(s.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-all"
                            aria-label="Delete conversation"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                            </svg>
                          </button>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function EmptyState({ onCreate, creating }: { onCreate: () => void; creating: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="text-5xl text-emerald-400/30">✦</div>
      <div>
        <p className="text-lg font-medium">No conversations yet</p>
        <p className="text-sm text-muted-foreground mt-1">Start a new AI chat to get going.</p>
      </div>
      <button
        onClick={onCreate}
        disabled={creating}
        className="mt-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 disabled:opacity-50 transition-colors"
      >
        {creating ? "Creating…" : "Start your first chat"}
      </button>
    </div>
  );
}

function AnonymousHero({ onCreate, creating }: { onCreate: () => void; creating: boolean }) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="text-6xl text-emerald-400/40">✦</div>
      <div>
        <h1 className="text-2xl font-bold">AI Chat</h1>
        <p className="text-muted-foreground mt-2 max-w-sm">
          Chat with AI assistants. Sign in for conversation history, BYOK support, and group AI chat.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          href="/auth/login"
          className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors text-center"
        >
          Sign in
        </Link>
        <button
          onClick={onCreate}
          disabled={creating}
          className="flex-1 py-2.5 rounded-xl border border-white/15 text-sm font-medium hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          {creating ? "Starting…" : "Try anonymously"}
        </button>
      </div>
    </div>
  );
}
