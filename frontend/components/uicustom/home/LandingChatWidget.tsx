"use client";

/**
 * @fileOverview Landing page AI chat widget.
 * – Mobile (<md): floating bottom-right button → overlay panel (existing behaviour)
 * – Desktop (≥md): inline expanded chat panel, starts open, t3.chat inspired
 * @stability stable
 */

import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelState = "collapsed" | "lite";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  participantName?: string;
  sensitiveTypes?: string[];
  createdAt: number;
}

interface WidgetState {
  panel: PanelState;
  messages: Message[];
  input: string;
  isStreaming: boolean;
  sessionId: string | null;
  error: string | null;
  rateLimitReset: number | null;
}

type WidgetAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "SET_INPUT"; value: string }
  | { type: "ADD_USER_MSG"; msg: Message }
  | { type: "START_STREAM"; assistantId: string }
  | { type: "APPEND_CHUNK"; id: string; text: string }
  | { type: "STREAM_DONE"; sensitiveTypes?: string[] }
  | { type: "SET_SESSION"; id: string }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_RATE_LIMIT"; resetAt: number }
  | { type: "CLEAR_ERROR" }
  | { type: "LOAD_HISTORY"; messages: Message[] };

// ─── Constants ────────────────────────────────────────────────────────────────

const ANON_MAX_LENGTH = 500;
const LS_KEY = "veggat:ai-chat-anon";
const PROVIDERS = ["GOOGLE", "GROQ", "OPENAI", "ANTHROPIC", "OPENROUTER", "GROK"] as const;
type Provider = (typeof PROVIDERS)[number];

const PROVIDER_LABELS: Record<Provider, string> = {
  GOOGLE: "Gemini Flash",
  GROQ: "Llama (Groq)",
  OPENAI: "ChatGPT",
  ANTHROPIC: "Claude",
  OPENROUTER: "OpenRouter",
  GROK: "Grok",
};

/** Provider console URLs for "Get a key" links */
const PROVIDER_KEY_URLS: Partial<Record<Provider, string>> = {
  OPENAI: "https://platform.openai.com/api-keys",
  ANTHROPIC: "https://console.anthropic.com/settings/keys",
  GOOGLE: "https://aistudio.google.com/apikey",
  GROQ: "https://console.groq.com/keys",
  GROK: "https://console.x.ai",
  OPENROUTER: "https://openrouter.ai/keys",
};

/** Detect provider from API key prefix — same logic as PollBuilder */
function inferProviderFromApiKey(input: string): Provider | null {
  const key = input.trim();
  const lower = key.toLowerCase();
  if (!lower) return null;
  if (lower.startsWith("gsk_")) return "GROQ";
  if (lower.startsWith("sk-or-")) return "OPENROUTER";
  if (lower.startsWith("sk-ant-")) return "ANTHROPIC";
  if (lower.startsWith("xai-")) return "GROK";
  if (key.startsWith("AIza")) return "GOOGLE";
  if (lower.startsWith("sk-proj-") || lower.startsWith("sk-")) return "OPENAI";
  return null;
}

const SUGGESTED_PROMPTS = [
  "What can I do here?",
  "How do live polls work?",
  "How do I create a poll?",
  "Which AI models are available?",
];

/** Default model per provider for the chat widget */
function widgetModel(provider: Provider, explicit?: string): string | undefined {
  if (explicit) return explicit;
  if (provider === "GOOGLE") return "gemini-2.5-flash";
  return undefined; // let the route pick defaults for other providers
}

// Client-side sensitive data patterns (same logic as server)
const SENSITIVE_PATTERNS = [
  { type: "email", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { type: "phone", regex: /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/ },
];

function detectClientSensitive(text: string): string[] {
  return SENSITIVE_PATTERNS.filter((p) => p.regex.test(text)).map((p) => p.type);
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: WidgetState, action: WidgetAction): WidgetState {
  switch (action.type) {
    case "OPEN":
      return { ...state, panel: "lite", error: null };
    case "CLOSE":
      return { ...state, panel: "collapsed" };
    case "SET_INPUT":
      return { ...state, input: action.value };
    case "ADD_USER_MSG":
      return { ...state, messages: [...state.messages, action.msg], input: "" };
    case "START_STREAM": {
      const aiMsg: Message = {
        id: action.assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };
      return { ...state, messages: [...state.messages, aiMsg], isStreaming: true };
    }
    case "APPEND_CHUNK":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, content: m.content + action.text } : m
        ),
      };
    case "STREAM_DONE":
      return { ...state, isStreaming: false };
    case "SET_SESSION":
      return { ...state, sessionId: action.id };
    case "SET_ERROR":
      return {
        ...state,
        error: action.error,
        isStreaming: false,
        // Remove any trailing empty assistant message left by a failed stream
        messages: state.messages.filter(
          (m, i) => !(i === state.messages.length - 1 && m.role === "assistant" && !m.content)
        ),
      };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    case "SET_RATE_LIMIT":
      return { ...state, rateLimitReset: action.resetAt, error: "RATE_LIMITED", isStreaming: false };
    case "LOAD_HISTORY":
      return { ...state, messages: action.messages };
    default:
      return state;
  }
}

const INITIAL_STATE: WidgetState = {
  panel: "collapsed",
  messages: [],
  input: "",
  isStreaming: false,
  sessionId: null,
  error: null,
  rateLimitReset: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function loadAnonHistory(): Message[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAnonHistory(messages: Message[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(messages.slice(-40)));
  } catch {}
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface LandingChatWidgetProps {
  isLoggedIn: boolean;
  userId: string | null;
}

export default function LandingChatWidget({ isLoggedIn, userId: _userId }: LandingChatWidgetProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [provider, setProvider] = useState<Provider>("GOOGLE");
  const [showLongMsgGate, setShowLongMsgGate] = useState(false);
  const [sensitiveBanner, setSensitiveBanner] = useState<string[] | null>(null);

  // ── BYOK (Bring Your Own Key) state ─────────────────────────────────────
  const [byokKey, setByokKey] = useState("");
  const [byokRemember, setByokRemember] = useState(false);
  const [showByokPanel, setShowByokPanel] = useState(false);
  const detectedByokProvider = React.useMemo(() => inferProviderFromApiKey(byokKey), [byokKey]);
  /** The effective provider — BYOK detection overrides the dropdown */
  const activeProvider = detectedByokProvider ?? provider;
  /** Whether a valid inline BYOK key is active */
  const byokActive = byokKey.trim().length >= 8 && detectedByokProvider !== null;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load anon history on mount
  useEffect(() => {
    if (!isLoggedIn) {
      const history = loadAnonHistory();
      if (history.length > 0) {
        dispatch({ type: "LOAD_HISTORY", messages: history });
      }
    }
  }, [isLoggedIn]);

  // Persist anon history
  useEffect(() => {
    if (!isLoggedIn && state.messages.length > 0) {
      saveAnonHistory(state.messages);
    }
  }, [isLoggedIn, state.messages]);

  // Scroll to bottom — only within the chat container, never the page
  useEffect(() => {
    const el = messagesEndRef.current;
    if (!el) return;
    const container = el.closest(".overflow-y-auto");
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }, [state.messages, reduceMotion]);

  // Focus input when panel opens — preventScroll stops the page from jumping
  useEffect(() => {
    if (state.panel === "lite") {
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
    }
  }, [state.panel]);

  const handleOpen = useCallback(() => dispatch({ type: "OPEN" }), []);
  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "CLOSE" });
  }, []);

  const handleExpand = useCallback(() => {
    if (state.sessionId) {
      router.push(`/ai/${state.sessionId}`);
    } else {
      router.push("/ai");
    }
  }, [router, state.sessionId]);

  const createSession = useCallback(async (): Promise<string | null> => {
    if (!isLoggedIn) return null;
    try {
      const res = await fetch("/api/ai-chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Chat from widget" }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.id ?? null;
    } catch {
      return null;
    }
  }, [isLoggedIn]);

  const saveMessagePair = useCallback(
    async (
      sessionId: string,
      userContent: string,
      aiContent: string,
      _sensitiveTypes: string[],
      providerUsed?: string,
      modelUsed?: string,
    ) => {
      try {
        await fetch(`/api/ai-chat/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage: userContent,
            assistantMessage: aiContent,
            providerUsed: providerUsed ?? "GOOGLE",
            modelUsed: modelUsed ?? "gemini-2.0-flash",
          }),
        });
      } catch {}
    },
    []
  );

  const handleSend = useCallback(async () => {
    const trimmed = state.input.trim();
    if (!trimmed || state.isStreaming) return;

    // Long message gate for anonymous users
    if (!isLoggedIn && trimmed.length > ANON_MAX_LENGTH) {
      setShowLongMsgGate(true);
      return;
    }

    // Client-side sensitive data detection
    const sensitiveTypes = detectClientSensitive(trimmed);
    if (sensitiveTypes.length > 0) {
      setSensitiveBanner(sensitiveTypes);
    }

    const userMsgId = genId();
    const userMsg: Message = {
      id: userMsgId,
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    dispatch({ type: "ADD_USER_MSG", msg: userMsg });

    // Create session on first message if logged in
    let sessionId = state.sessionId;
    if (isLoggedIn && !sessionId) {
      sessionId = await createSession();
      if (sessionId) {
        dispatch({ type: "SET_SESSION", id: sessionId });
      }
    }

    // Build messages for API — filter out empty-content messages from failed streams
    const apiMessages = [
      ...state.messages
        .filter((m) => m.content.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: trimmed },
    ].slice(-20);

    const assistantId = genId();
    dispatch({ type: "START_STREAM", assistantId });

    const abort = new AbortController();
    abortRef.current = abort;

    let fullAiContent = "";
    let responseSensitiveTypes: string[] = [];

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          sessionId,
          provider: activeProvider,
          model: widgetModel(activeProvider),
          ...(byokActive && {
            aiAuth: {
              mode: "one_time" as const,
              apiKey: byokKey.trim(),
              provider: detectedByokProvider!,
              rememberKey: byokRemember,
            },
          }),
        }),
        signal: abort.signal,
      });

      // Check for server-detected sensitive types
      const serverSensitive = res.headers.get("X-Sensitive-Types");
      if (serverSensitive) {
        responseSensitiveTypes = serverSensitive.split(",").filter(Boolean);
        setSensitiveBanner((prev) => [
          ...(prev ?? []),
          ...responseSensitiveTypes.filter((t) => !prev?.includes(t)),
        ]);
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          if (errData.resetAt) {
            dispatch({ type: "SET_RATE_LIMIT", resetAt: errData.resetAt });
          } else {
            dispatch({ type: "SET_ERROR", error: errData.message ?? "Rate limit reached." });
          }
          return;
        }
        // Map specific error codes to user-friendly messages
        const errorMessage =
          errData.message ??
          (errData.error === "AI_NOT_CONFIGURED"
            ? "AI chat isn't configured on this platform yet. Sign in to use your own API key."
            : errData.error === "BYOK_REQUIRED"
            ? `To use ${errData.provider ?? "this provider"}, add your API key in Settings → AI Keys.`
            : errData.error === "QUOTA_EXCEEDED"
            ? "Daily free AI limit reached. Add your own API key in Settings → AI Keys."
            : errData.error === "CONVERSATION_SUSPENDED"
            ? "This conversation has been suspended."
            : errData.error === "BLOCKED"
            ? "Message blocked by safety filter. Please rephrase."
            : "Something went wrong. Please try again.");
        dispatch({ type: "SET_ERROR", error: errorMessage });
        return;
      }

      // Stream SSE
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
              fullAiContent += parsed.text;
              dispatch({ type: "APPEND_CHUNK", id: assistantId, text: parsed.text });
            }
          } catch {}
        }
      }

      dispatch({ type: "STREAM_DONE" });

      // Persist to DB if logged in
      if (isLoggedIn && sessionId && fullAiContent) {
        saveMessagePair(
          sessionId,
          trimmed,
          fullAiContent,
          [...sensitiveTypes, ...responseSensitiveTypes],
          activeProvider,
          widgetModel(activeProvider),
        );
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      dispatch({ type: "SET_ERROR", error: "Connection lost. Try again." });
    }
  }, [state.input, state.isStreaming, state.messages, state.sessionId, isLoggedIn, activeProvider, byokActive, byokKey, byokRemember, detectedByokProvider, createSession, saveMessagePair]);

  // Desktop-specific open/close state (independent of mobile panel state)
  const [desktopOpen, setDesktopOpen] = useState(true);

  return (
    <>
      {/* ──────────────────────────────────────────────────────────────── */}
      {/*  MOBILE landscape (< md)  — floating bottom-right widget        */}
      {/*  Hidden on portrait (inline panel shown there instead)          */}
      {/* ──────────────────────────────────────────────────────────────── */}
      <div className="portrait:hidden md:hidden">
        {/* Floating toggle button */}
        <AnimatePresence>
          {state.panel === "collapsed" && (
            <motion.button
              key="chat-bubble"
              initial={{ opacity: 0, scale: 0.8, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 16 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
              onClick={handleOpen}
              aria-label="Open AI chat"
              className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full glass-panel shadow-lg shadow-emerald-500/10 text-sm font-medium text-foreground hover:border-emerald-400/60 hover:shadow-emerald-400/20 transition-colors"
            >
              <span className="text-emerald-400 text-base">✦</span>
              <span>Ask AI</span>
              {state.messages.length > 0 && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black">
                  {state.messages.filter((m) => m.role === "user").length}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Mobile chat overlay */}
        <AnimatePresence>
          {state.panel === "lite" && (
            <motion.div
              key="chat-panel-mobile"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="fixed bottom-6 right-6 z-50 flex flex-col glass-panel rounded-2xl shadow-2xl shadow-black/30"
              style={{ width: "min(360px, calc(100vw - 32px))", height: "min(520px, calc(100dvh - 160px))" }}
              role="dialog"
              aria-label="AI chat"
            >
              <ChatPanelInner
                state={state}
                dispatch={dispatch}
                provider={provider}
                setProvider={setProvider}
                isLoggedIn={isLoggedIn}
                sensitiveBanner={sensitiveBanner}
                setSensitiveBanner={setSensitiveBanner}
                showLongMsgGate={showLongMsgGate}
                setShowLongMsgGate={setShowLongMsgGate}
                messagesEndRef={messagesEndRef}
                inputRef={inputRef}
                reduceMotion={!!reduceMotion}
                onSend={handleSend}
                onClose={handleClose}
                onExpand={handleExpand}
                onSuggest={(text) => {
                  dispatch({ type: "SET_INPUT", value: text });
                  setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
                }}
                byokKey={byokKey}
                setByokKey={setByokKey}
                byokRemember={byokRemember}
                setByokRemember={setByokRemember}
                showByokPanel={showByokPanel}
                setShowByokPanel={setShowByokPanel}
                byokActive={byokActive}
                detectedByokProvider={detectedByokProvider}
                activeProvider={activeProvider}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ──────────────────────────────────────────────────────────────── */}
      {/*  DESKTOP/TABLET landscape (≥ md) + any PORTRAIT orientation     */}
      {/*  — inline expanded panel inside the hero                        */}
      {/* ──────────────────────────────────────────────────────────────── */}
      <div
        className="hidden portrait:flex md:landscape:flex flex-col items-center w-full px-4 pb-6 pt-4"
      >
        {/* Section label */}
        <div className="mb-3 text-center">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground/50">Ask AI</span>
        </div>
        <AnimatePresence mode="wait">
          {desktopOpen ? (
            /* ── Expanded chat panel ── */
            <motion.div
              key="desktop-panel"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="w-full max-w-2xl flex flex-col glass-panel rounded-2xl shadow-2xl shadow-black/20 chat-desktop-panel"
              style={{ height: "clamp(320px, 42vh, 480px)" }}
              role="complementary"
              aria-label="AI chat"
            >
              <ChatPanelInner
                state={state}
                dispatch={dispatch}
                provider={provider}
                setProvider={setProvider}
                isLoggedIn={isLoggedIn}
                sensitiveBanner={sensitiveBanner}
                setSensitiveBanner={setSensitiveBanner}
                showLongMsgGate={showLongMsgGate}
                setShowLongMsgGate={setShowLongMsgGate}
                messagesEndRef={messagesEndRef}
                inputRef={inputRef}
                reduceMotion={!!reduceMotion}
                onSend={handleSend}
                onClose={() => setDesktopOpen(false)}
                onExpand={handleExpand}
                onSuggest={(text) => {
                  dispatch({ type: "SET_INPUT", value: text });
                  setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
                }}
                desktopMode
                byokKey={byokKey}
                setByokKey={setByokKey}
                byokRemember={byokRemember}
                setByokRemember={setByokRemember}
                showByokPanel={showByokPanel}
                setShowByokPanel={setShowByokPanel}
                byokActive={byokActive}
                detectedByokProvider={detectedByokProvider}
                activeProvider={activeProvider}
              />
            </motion.div>
          ) : (
            /* ── Collapsed bar on desktop ── */
            <motion.button
              key="desktop-collapsed"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
              onClick={() => setDesktopOpen(true)}
              className="flex items-center gap-3 px-5 py-3.5 rounded-2xl glass-panel hover:border-emerald-500/30 hover:shadow-emerald-500/10 shadow-lg transition-all group max-w-2xl w-full"
            >
              <span className="text-emerald-400 text-lg group-hover:scale-110 transition-transform">✦</span>
              <div className="flex-1 text-left">
                <span className="text-sm font-medium text-foreground">Ask AI</span>
                <span className="text-xs text-muted-foreground ml-2">Tap to expand</span>
              </div>
              {state.messages.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black">
                  {state.messages.filter((m) => m.role === "user").length}
                </span>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// ─── Shared chat panel inner content ─────────────────────────────────────────

interface ChatPanelInnerProps {
  state: WidgetState;
  dispatch: React.Dispatch<WidgetAction>;
  provider: Provider;
  setProvider: (p: Provider) => void;
  isLoggedIn: boolean;
  sensitiveBanner: string[] | null;
  setSensitiveBanner: (v: string[] | null) => void;
  showLongMsgGate: boolean;
  setShowLongMsgGate: (v: boolean) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  reduceMotion: boolean;
  onSend: () => void;
  onClose: () => void;
  onExpand: () => void;
  onSuggest: (text: string) => void;
  desktopMode?: boolean;
  // BYOK props
  byokKey: string;
  setByokKey: (v: string) => void;
  byokRemember: boolean;
  setByokRemember: (v: boolean) => void;
  showByokPanel: boolean;
  setShowByokPanel: (v: boolean) => void;
  byokActive: boolean;
  detectedByokProvider: Provider | null;
  activeProvider: Provider;
}

function ChatPanelInner({
  state, dispatch, provider, setProvider, isLoggedIn,
  sensitiveBanner, setSensitiveBanner,
  showLongMsgGate, setShowLongMsgGate,
  messagesEndRef, inputRef, reduceMotion,
  onSend, onClose, onExpand, onSuggest,
  desktopMode = false,
  byokKey, setByokKey, byokRemember, setByokRemember,
  showByokPanel, setShowByokPanel, byokActive, detectedByokProvider, activeProvider,
}: ChatPanelInnerProps) {
  // Auto-resize textarea to fit content (enables Shift+Enter multi-line)
  const latestInput = state.input;
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [latestInput, inputRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
      // Shift+Enter falls through naturally — browser inserts a newline
    },
    [onSend]
  );

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/8 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">✦</span>
          <span className="text-sm font-semibold">Ask AI</span>
          {!isLoggedIn && (
            <span className="text-[10px] text-muted-foreground bg-white/5 rounded px-1.5 py-0.5">
              Free preview
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Provider selector — shown to logged-in users */}
          {isLoggedIn && (
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="text-[11px] bg-transparent text-muted-foreground border border-black/12 dark:border-white/10 rounded px-1.5 py-1 cursor-pointer hover:border-black/20 dark:hover:border-white/20 focus:outline-none"
              title="AI provider"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
          )}
          {/* BYOK toggle */}
          {isLoggedIn && (
            <button
              onClick={() => setShowByokPanel(!showByokPanel)}
              className={`p-1.5 rounded-lg transition-colors ${
                byokActive
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "hover:bg-black/6 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground"
              }`}
              title={byokActive ? `Using your ${PROVIDER_LABELS[activeProvider]} key` : "Bring your own key"}
              aria-label="Toggle BYOK panel"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </button>
          )}
          {/* Expand to full chat page */}
          <button
            onClick={onExpand}
            className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            title="Open full chat"
            aria-label="Expand to full page"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
          {/* Close / collapse */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close chat"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── BYOK Panel ── */}
      <AnimatePresence>
        {showByokPanel && isLoggedIn && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden shrink-0"
          >
            <div className="px-3 py-2.5 border-b border-black/8 dark:border-white/10 bg-black/2 dark:bg-white/[0.02] space-y-2">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                  {byokActive ? (
                    <>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {PROVIDER_LABELS[activeProvider]} connected
                    </>
                  ) : (
                    <>🔑 Bring your own key</>
                  )}
                </p>
                <button
                  onClick={() => setShowByokPanel(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  title="Close"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Key input */}
              <div className="relative">
                <input
                  value={byokKey}
                  onChange={(e) => {
                    const next = e.target.value;
                    setByokKey(next);
                    // Auto-switch provider dropdown to match detected key
                    const inferred = inferProviderFromApiKey(next);
                    if (inferred && inferred !== provider) setProvider(inferred);
                  }}
                  type="password"
                  placeholder={`Paste your ${PROVIDER_LABELS[provider]} API key`}
                  className="w-full h-8 bg-black/4 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-xs font-mono placeholder:font-sans px-2.5 pr-8 text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-emerald-500/40 transition-colors"
                />
                {byokKey.trim() && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {byokActive ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-400">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-amber-400">
                          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                        </svg>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Auto-detect hint */}
              {byokKey.trim() && detectedByokProvider && (
                <p className="text-[10px] text-emerald-400/80 flex items-center gap-1">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                  Detected {PROVIDER_LABELS[detectedByokProvider]}
                  {detectedByokProvider !== provider && <span className="text-muted-foreground">(switched)</span>}
                </p>
              )}

              {/* Bottom row: clear/connect + get key link + remember */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {byokActive ? (
                    <button
                      onClick={() => { setByokKey(""); setShowByokPanel(false); }}
                      className="h-6 px-2.5 rounded-md bg-red-500/10 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowByokPanel(false)}
                      disabled={!byokKey.trim()}
                      className={`h-6 px-2.5 rounded-md text-[10px] font-medium transition-colors ${
                        byokKey.trim()
                          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                          : "bg-black/4 dark:bg-white/5 text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      Connect
                    </button>
                  )}
                  <a
                    href={PROVIDER_KEY_URLS[byokActive ? activeProvider : provider] ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-emerald-400/70 hover:text-emerald-300 transition-colors"
                  >
                    Get a key ↗
                  </a>
                </div>
                {/* Remember toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={byokRemember}
                    onChange={(e) => setByokRemember(e.target.checked)}
                    className="h-3 w-3 rounded border-black/20 dark:border-white/20 accent-emerald-500"
                  />
                  <span className="text-[10px] text-muted-foreground">Save</span>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sensitive data warning */}
      <AnimatePresence>
        {sensitiveBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden shrink-0"
          >
            <div className="flex items-start gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span className="flex-1">
                Your message may contain {sensitiveBanner.join(" and ")} data. Avoid sharing personal details.
              </span>
              <button onClick={() => setSensitiveBanner(null)} className="shrink-0 text-amber-400 hover:text-amber-200 leading-none">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {state.messages.length === 0 ? (
          /* Empty state with suggested prompts */
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className={`text-emerald-400 ${desktopMode ? "text-4xl" : "text-3xl"}`}>✦</div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {isLoggedIn ? `Chat with ${PROVIDER_LABELS[provider]}` : "Ask anything about Freedom Store™"}
              </p>
              <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">
                {isLoggedIn
                  ? "Ask about features, get recommendations, or just chat."
                  : "Free preview powered by Gemini. Sign in to pick your AI model and save history."}
              </p>
            </div>
            {/* Suggested prompts */}
            <div className={`flex flex-wrap gap-2 justify-center ${desktopMode ? "max-w-lg" : "max-w-[280px]"}`}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onSuggest(prompt)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-black/4 dark:bg-white/5 border border-black/10 dark:border-white/10 text-muted-foreground hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
            {!isLoggedIn && (
              <a
                href="/sign-in"
                className="text-[11px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
              >
                Sign in for full access
              </a>
            )}
          </div>
        ) : (
          <>
            {state.messages
              .filter((msg) => !(msg.role === "assistant" && msg.content === ""))
              .map((msg) => (
                <MessageBubble key={msg.id} msg={msg} reduceMotion={reduceMotion} />
              ))}
            {state.isStreaming &&
              state.messages[state.messages.length - 1]?.role === "assistant" &&
              state.messages[state.messages.length - 1]?.content === "" && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-400 shrink-0">✦</div>
                    <div className="bg-black/4 dark:bg-white/5 border border-black/8 dark:border-white/8 rounded-2xl px-3 py-2">
                      <TypingIndicator />
                    </div>
                  </div>
                </div>
              )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {state.error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-xs text-red-400">
              <span className="flex-1">
                {state.error === "RATE_LIMITED"
                  ? `Too many requests.${state.rateLimitReset ? ` Try again after ${new Date(state.rateLimitReset).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : " Please wait."} ${!isLoggedIn ? "Sign in for higher limits." : ""}`
                  : state.error}
              </span>
              <button onClick={() => dispatch({ type: "CLEAR_ERROR" })} className="shrink-0 hover:text-red-200">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Long message gate */}
      <AnimatePresence>
        {showLongMsgGate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="flex flex-col gap-2 px-4 py-3 bg-emerald-500/10 border-t border-emerald-500/20 text-xs">
              <span className="text-emerald-300">Longer messages need an account — free, takes 10 seconds.</span>
              <div className="flex gap-2">
                <a href="/sign-in" className="flex-1 text-center py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors">Sign in</a>
                <button onClick={() => setShowLongMsgGate(false)} className="px-3 py-1.5 rounded-lg bg-white/10 text-muted-foreground hover:bg-white/15 transition-colors">Dismiss</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="px-3 py-3 border-t border-black/8 dark:border-white/10 shrink-0 chat-input-area">
        <div className="flex items-end gap-2 rounded-xl bg-black/4 dark:bg-white/5 px-3 py-2 border border-black/10 dark:border-white/10 chat-input-wrapper">
          <textarea
            ref={inputRef}
            value={state.input}
            onChange={(e) => {
              dispatch({ type: "SET_INPUT", value: e.target.value });
              if (showLongMsgGate && e.target.value.length <= ANON_MAX_LENGTH) setShowLongMsgGate(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything…"
            rows={1}
            disabled={state.isStreaming}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none max-h-32 disabled:opacity-50"
            style={{ lineHeight: "1.4", scrollbarWidth: "none" }}
            aria-label="Chat message"
          />
          <button
            onClick={onSend}
            disabled={!state.input.trim() || state.isStreaming}
            className="shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors chat-send-btn"
            aria-label="Send"
          >
            {state.isStreaming ? (
              <span className="h-3 w-3 rounded-full border-2 border-black/50 border-t-transparent animate-spin" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
        {!isLoggedIn && state.input.length > ANON_MAX_LENGTH * 0.7 && (
          <div className={`text-right text-[10px] mt-1 ${state.input.length > ANON_MAX_LENGTH ? "text-red-400" : "text-muted-foreground/60"}`}>
            {state.input.length}/{ANON_MAX_LENGTH}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MessageBubble({ msg, reduceMotion }: { msg: Message; reduceMotion: boolean }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.15 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="mr-2 mt-1 shrink-0 h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-400">
          ✦
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? "bg-emerald-500/15 border border-emerald-500/20 text-foreground rounded-tr-sm"
            : "bg-black/4 dark:bg-white/5 border border-black/8 dark:border-white/8 text-foreground rounded-tl-sm"
        }`}
      >
        {msg.content}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <span className="inline-flex gap-1 items-center h-4">
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current opacity-60" />
    </span>
  );
}
