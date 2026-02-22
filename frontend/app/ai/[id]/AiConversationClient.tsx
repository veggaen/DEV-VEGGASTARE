"use client";

import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  id: string;
  type: "HUMAN" | "AI_PLATFORM" | "AI_BYOK";
  displayName: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  responseMode: "CONTEXT_ONLY" | "DEEP_ANALYSIS";
  responseBrief: boolean;
  manualOnly: boolean;
  isActive: boolean;
  byokUserId: string | null;
}

interface ConvMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  senderType: "HUMAN" | "AI_PLATFORM" | "AI_BYOK";
  modelUsed: string | null;
  createdAt: string;
  participant: { displayName: string | null; type: string };
  hasSensitiveData: boolean;
  sensitiveTypes: string[];
}

interface ConvSession {
  id: string;
  title: string;
  isPublic: boolean;
  isSuspended: boolean;
  suspendedReason: string | null;
  triggerMode: string;
  creatorId: string;
  participants: Participant[];
  messages: ConvMessage[];
}

// ─── Streaming message (local) ────────────────────────────────────────────────

interface StreamingMsg {
  id: string;
  participantId: string | null;
  participantName: string;
  content: string;
  done: boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  sessionId: string;
  isLoggedIn: boolean;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AiConversationClient({
  sessionId,
  isLoggedIn,
  userId,
  userName,
  userRole,
}: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [conv, setConv] = useState<ConvSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMsgs, setStreamingMsgs] = useState<StreamingMsg[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sensitiveBanner, setSensitiveBanner] = useState<string[] | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isCreator = conv?.creatorId === userId;
  const isAdmin = userRole === "ADMIN" || userRole === "OWNER";

  // ── Load conversation ──
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/ai-chat/sessions/${sessionId}`);
        if (!res.ok) {
          if (res.status === 404) setError("Conversation not found.");
          else if (res.status === 403) setError("Access denied.");
          else if (res.status === 410) setError("This conversation has been deleted.");
          else setError("Failed to load conversation.");
          return;
        }
        const data = await res.json();
        // API returns the conversation directly (not wrapped in { conversation })
        setConv(data.conversation ?? data);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  // ── Scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, [conv?.messages, streamingMsgs, reduceMotion]);

  // ── Auto-resize textarea (enables Shift+Enter multi-line) ──
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // ── Client-side sensitive detection ──
  const SENSITIVE_RE = [
    { type: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
    { type: "phone", re: /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/ },
  ];
  const detectSensitive = (text: string) =>
    SENSITIVE_RE.filter((p) => p.re.test(text)).map((p) => p.type);

  // ── Send message ──
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    if (!isLoggedIn) {
      setSendError("Please sign in to send messages.");
      return;
    }

    setSendError(null);
    const sensitive = detectSensitive(trimmed);
    if (sensitive.length > 0) setSensitiveBanner(sensitive);

    setInput("");
    setIsStreaming(true);

    // Optimistic append of user message
    const tempUserMsg: ConvMessage = {
      id: `temp-${Date.now()}`,
      content: trimmed,
      role: "user",
      senderType: "HUMAN",
      modelUsed: null,
      createdAt: new Date().toISOString(),
      participant: { displayName: userName, type: "HUMAN" },
      hasSensitiveData: sensitive.length > 0,
      sensitiveTypes: sensitive,
    };
    setConv((prev) => prev ? { ...prev, messages: [...prev.messages, tempUserMsg] } : prev);

    // Stream
    const aiStreamId = `stream-${Date.now()}`;
    setStreamingMsgs([{
      id: aiStreamId,
      participantId: null,
      participantName: "AI",
      content: "",
      done: false,
    }]);

    const abort = new AbortController();
    abortRef.current = abort;

    let fullContent = "";
    let responseSensitive: string[] = [];

    try {
      const history = conv?.messages ?? [];
      const apiMessages = [
        ...history.slice(-19).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: trimmed },
      ];

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, sessionId }),
        signal: abort.signal,
      });

      const serverSensitive = res.headers.get("X-Sensitive-Types");
      if (serverSensitive) {
        responseSensitive = serverSensitive.split(",").filter(Boolean);
        setSensitiveBanner((prev) => [...(prev ?? []), ...responseSensitive.filter((t) => !prev?.includes(t))]);
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSendError(errData.message ?? "Failed to get response.");
        setIsStreaming(false);
        setStreamingMsgs([]);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.text) {
              fullContent += parsed.text;
              setStreamingMsgs((prev) =>
                prev.map((m) => m.id === aiStreamId ? { ...m, content: m.content + parsed.text } : m)
              );
            }
          } catch {}
        }
      }

      setStreamingMsgs((prev) => prev.map((m) => m.id === aiStreamId ? { ...m, done: true } : m));

      // Persist and reload messages
      if (fullContent) {
        await fetch(`/api/ai-chat/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userContent: trimmed,
            aiContent: fullContent,
            sensitiveTypes: [...sensitive, ...responseSensitive],
          }),
        });
      }

      // Reload session to get persisted messages
      const refreshed = await fetch(`/api/ai-chat/sessions/${sessionId}`);
      if (refreshed.ok) {
        const data = await refreshed.json();
        setConv(data.conversation);
      }
      setStreamingMsgs([]);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setSendError("Connection error. Please try again.");
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, isLoggedIn, conv, sessionId, userName]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Trigger BYOK AI ──
  const handleTriggerAi = useCallback(async (participantId: string) => {
    const abort = new AbortController();
    abortRef.current = abort;
    const participant = conv?.participants.find((p) => p.id === participantId);
    const streamId = `byok-${Date.now()}`;

    setStreamingMsgs([{
      id: streamId,
      participantId,
      participantName: participant?.displayName ?? "AI",
      content: "",
      done: false,
    }]);
    setIsStreaming(true);

    let fullContent = "";

    try {
      const res = await fetch(`/api/ai-chat/sessions/${sessionId}/trigger-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSendError(err.error ?? "Failed to trigger AI.");
        setStreamingMsgs([]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.text) {
              fullContent += parsed.text;
              setStreamingMsgs((prev) =>
                prev.map((m) => m.id === streamId ? { ...m, content: m.content + parsed.text } : m)
              );
            }
          } catch {}
        }
      }

      // Reload
      const refreshed = await fetch(`/api/ai-chat/sessions/${sessionId}`);
      if (refreshed.ok) {
        const data = await refreshed.json();
        setConv(data.conversation ?? data);
      }
      setStreamingMsgs([]);
    } catch (err: any) {
      if (err?.name !== "AbortError") setSendError("Stream error.");
    } finally {
      setIsStreaming(false);
    }
  }, [conv, sessionId]);

  // ── Delete conversation ──
  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this conversation? This cannot be undone.")) return;
    const res = await fetch(`/api/ai-chat/sessions/${sessionId}`, { method: "DELETE" });
    if (res.ok) router.push("/ai");
  }, [sessionId, router]);

  // ── Copy share link ──
  const handleShare = useCallback(async () => {
    if (!conv) return;
    if (!conv.isPublic) {
      await fetch(`/api/ai-chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: true }),
      });
      setConv((prev) => prev ? { ...prev, isPublic: true } : prev);
    }
    navigator.clipboard.writeText(`${window.location.origin}/ai/${sessionId}`).catch(() => {});
    alert("Link copied to clipboard.");
  }, [conv, sessionId]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-emerald-500/40 border-t-emerald-400 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading conversation…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">✦</div>
          <p className="text-lg font-semibold mb-2">Oops</p>
          <p className="text-muted-foreground text-sm mb-6">{error}</p>
          <Link href="/ai" className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400 transition-colors">
            Back to AI Chat
          </Link>
        </div>
      </div>
    );
  }

  if (!conv) return null;

  const aiParticipants = conv.participants.filter(
    (p) => p.type === "AI_BYOK" || p.type === "AI_PLATFORM"
  );
  const myByokAis = aiParticipants.filter(
    (p) => p.type === "AI_BYOK" && p.byokUserId === userId
  );

  const allMessages: Array<ConvMessage | StreamingMsg & { _streaming: true }> = [
    ...conv.messages,
    ...streamingMsgs.map((s) => ({ ...s, _streaming: true as true })),
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {/* ── Top bar ── */}
      <div className="border-b border-white/8 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/ai" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </Link>
          <span className="text-emerald-400 shrink-0">✦</span>
          <h1 className="text-sm font-semibold truncate">{conv.title}</h1>
          {conv.isSuspended && (
            <span className="text-xs text-red-400 border border-red-500/30 rounded px-1.5 py-0.5 shrink-0">
              Suspended
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isLoggedIn && (
            <button
              onClick={handleShare}
              className="p-2 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors"
              title={conv.isPublic ? "Copy share link" : "Make public & copy link"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
              </svg>
            </button>
          )}

          <button
            onClick={() => setShowSettings((v) => !v)}
            className="p-2 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors"
            title="Settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>

          {/* Participants sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors"
            title="Participants"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Messages + input */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Suspended banner */}
          {conv.isSuspended && (
            <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 text-sm text-red-400 text-center">
              This conversation has been suspended by a moderator.
              {conv.suspendedReason && <> Reason: {conv.suspendedReason}</>}
            </div>
          )}

          {/* Sensitive data banner */}
          <AnimatePresence>
            {sensitiveBanner && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300">
                  <span className="mt-0.5">⚠</span>
                  <span className="flex-1">
                    Message contains {sensitiveBanner.join(" and ")} data sent to the AI. Avoid sharing personal information.
                  </span>
                  <button onClick={() => setSensitiveBanner(null)} className="text-amber-400 hover:text-amber-200">✕</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 max-w-3xl w-full mx-auto">
            {conv.messages.length === 0 && streamingMsgs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
                <div className="text-4xl text-emerald-400/30">✦</div>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Start the conversation. {aiParticipants.length > 0 ? `${aiParticipants.map((p) => p.displayName ?? "AI").join(", ")} ${aiParticipants.length === 1 ? "is" : "are"} ready.` : ""}
                </p>
              </div>
            )}

            {conv.messages.map((msg) => (
              <ConvMessageBubble key={msg.id} msg={msg} userId={userId} reduceMotion={!!reduceMotion} />
            ))}

            {streamingMsgs.map((s) => (
              <StreamingBubble key={s.id} msg={s} reduceMotion={!!reduceMotion} />
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Send error */}
          <AnimatePresence>
            {sendError && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden max-w-3xl w-full mx-auto px-4"
              >
                <div className="flex items-center gap-2 py-2 text-xs text-red-400 border-t border-red-500/20">
                  <span className="flex-1">{sendError}</span>
                  <button onClick={() => setSendError(null)}>✕</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          {!conv.isSuspended && (
            <div className="border-t border-white/8 px-4 py-3 shrink-0">
              <div className="max-w-3xl w-full mx-auto">
                <div className="ai-input-ring flex items-end gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/10 chat-input-wrapper">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isLoggedIn ? "Message…" : "Sign in to send messages"}
                    rows={1}
                    disabled={isStreaming || !isLoggedIn}
                    className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none max-h-40 disabled:opacity-50"
                    style={{ lineHeight: "1.4", scrollbarWidth: "none" }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isStreaming || !isLoggedIn}
                    className="shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors chat-send-btn"
                  >
                    {isStreaming ? (
                      <span className="h-3 w-3 rounded-full border-2 border-black/50 border-t-transparent animate-spin" />
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                </div>
                {!isLoggedIn && (
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    <Link href="/sign-in" className="text-emerald-400 hover:underline">Sign in</Link> to participate.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeInOut" }}
              className="border-l border-white/8 overflow-hidden shrink-0 flex flex-col bg-background"
            >
              <div className="px-4 py-4 border-b border-white/8 flex items-center justify-between">
                <span className="text-sm font-medium">Participants</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                {conv.participants.map((p) => (
                  <ParticipantCard
                    key={p.id}
                    participant={p}
                    isOwner={p.byokUserId === userId}
                    onTrigger={handleTriggerAi}
                    isStreaming={isStreaming}
                  />
                ))}
              </div>

              {/* Admin actions */}
              {(isCreator || isAdmin) && (
                <div className="px-3 py-3 border-t border-white/8 space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-1">Actions</p>
                  {isCreator && (
                    <button
                      onClick={handleDelete}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Delete conversation
                    </button>
                  )}
                  {isAdmin && (
                    <Link
                      href={`/admin/ai-chat/${sessionId}`}
                      className="block text-xs px-3 py-2 rounded-lg text-muted-foreground hover:bg-white/5 transition-colors"
                    >
                      Admin view →
                    </Link>
                  )}
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ── Settings panel ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-4 bottom-20 md:inset-auto md:bottom-20 md:right-6 md:w-80 z-50 glass-panel rounded-2xl border border-white/10 shadow-xl p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Conversation Settings</span>
              <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ConvSettings conv={conv} sessionId={sessionId} onUpdate={setConv} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ParticipantCard ──────────────────────────────────────────────────────────

function ParticipantCard({
  participant: p,
  isOwner,
  onTrigger,
  isStreaming,
}: {
  participant: Participant;
  isOwner: boolean;
  onTrigger: (id: string) => void;
  isStreaming: boolean;
}) {
  const isAi = p.type === "AI_BYOK" || p.type === "AI_PLATFORM";
  return (
    <div className="px-3 py-3 rounded-xl bg-white/4 border border-white/8">
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${isAi ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-muted-foreground"}`}>
          {isAi ? "✦" : (p.displayName?.[0] ?? "?")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{p.displayName ?? (isAi ? "AI" : "Human")}</p>
          <p className="text-[10px] text-muted-foreground">
            {p.type === "AI_BYOK" ? `BYOK · ${p.aiProvider ?? ""}` : p.type === "AI_PLATFORM" ? `Platform · ${p.aiModel ?? ""}` : "Human"}
          </p>
        </div>
      </div>

      {/* BYOK AI owner controls */}
      {isOwner && isAi && p.type === "AI_BYOK" && (
        <div className="mt-2 pt-2 border-t border-white/8 space-y-2">
          <button
            onClick={() => onTrigger(p.id)}
            disabled={isStreaming}
            className="w-full text-xs py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
          >
            {isStreaming ? "Responding…" : `Prompt ${p.displayName ?? "AI"} to respond`}
          </button>
          <div className="flex gap-1 text-[10px]">
            <span className="text-muted-foreground">Mode:</span>
            <span className="text-foreground">{p.responseMode === "DEEP_ANALYSIS" ? "Deep" : "Context-only"}</span>
            <span className="text-muted-foreground ml-auto">{p.responseBrief ? "Brief" : "Detailed"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ConvSettings ─────────────────────────────────────────────────────────────

function ConvSettings({
  conv,
  sessionId,
  onUpdate,
}: {
  conv: ConvSession;
  sessionId: string;
  onUpdate: (updater: (prev: ConvSession | null) => ConvSession | null) => void;
}) {
  const [saving, setSaving] = useState(false);

  const patch = useCallback(async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        onUpdate((prev) => prev ? { ...prev, ...data } : prev);
      }
    } finally {
      setSaving(false);
    }
  }, [sessionId, onUpdate]);

  return (
    <div className="space-y-4 text-sm">
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Trigger mode</label>
        <select
          value={conv.triggerMode}
          onChange={(e) => patch({ triggerMode: e.target.value })}
          disabled={saving}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-emerald-500/40"
        >
          <option value="MENTION">@mention only</option>
          <option value="DEBOUNCE">Auto (debounced)</option>
          <option value="ALL">Respond to all</option>
          <option value="MANUAL">Manual only</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Public conversation</span>
        <button
          onClick={() => patch({ isPublic: !conv.isPublic })}
          disabled={saving}
          className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${conv.isPublic ? "bg-emerald-500" : "bg-white/15"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform mt-0.75 ${conv.isPublic ? "translate-x-4" : "translate-x-0.5"}`} style={{ marginTop: "3px", marginLeft: conv.isPublic ? undefined : "3px" }} />
        </button>
      </div>

      {saving && <p className="text-xs text-muted-foreground text-center">Saving…</p>}
    </div>
  );
}

// ─── Message bubbles ──────────────────────────────────────────────────────────

function ConvMessageBubble({
  msg,
  userId,
  reduceMotion,
}: {
  msg: ConvMessage;
  userId: string | null;
  reduceMotion: boolean;
}) {
  const isUser = msg.role === "user";
  const isMe = msg.participant.type === "HUMAN";
  const name = msg.participant.displayName ?? (isUser ? "You" : "AI");

  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.15 }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="mt-1 h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-400 shrink-0">
          ✦
        </div>
      )}
      <div className="max-w-[75%] space-y-1">
        {!isUser && (
          <p className="text-[10px] text-muted-foreground px-1">{name}</p>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap ${
            isUser
              ? "bg-emerald-500/15 border border-emerald-500/20 text-foreground"
              : "bg-white/5 border border-white/8 text-foreground"
          }`}
        >
          {msg.content}
        </div>
        {msg.hasSensitiveData && (
          <p className="text-[10px] text-amber-400/70 px-1">⚠ Contains sensitive data</p>
        )}
      </div>
    </motion.div>
  );
}

function StreamingBubble({ msg, reduceMotion }: { msg: StreamingMsg; reduceMotion: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.15 }}
      className="flex gap-3 justify-start"
    >
      <div className="mt-1 h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-400 shrink-0">
        ✦
      </div>
      <div className="max-w-[75%] space-y-1">
        <p className="text-[10px] text-muted-foreground px-1">{msg.participantName}</p>
        <div className="rounded-2xl px-4 py-2.5 bg-white/5 border border-white/8 text-sm leading-relaxed break-words whitespace-pre-wrap">
          {msg.content || (
            <span className="inline-flex gap-1 items-center h-4">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current opacity-60" />
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
