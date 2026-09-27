"use client";

/**
 * @fileOverview Landing page AI chat widget — T3.chat-inspired design.
 * – Mobile (<md): floating bottom-right button → overlay panel
 * – Desktop (≥md): inline expanded chat panel, expandable to near-fullscreen modal
 * – Model selector with provider groups, capability badges, descriptions
 * – BYOK inline key input with auto-detection
 * @stability active
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { ChatComposer } from '@/components/uicustom/ai/ChatComposer';
import { readChatStream } from '@/lib/ai-chat/read-stream';
import dynamic from 'next/dynamic';
const MessageContent = dynamic(() => import('@/components/uicustom/ai/MessageContent').then(m => m.MessageContent));
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CreditModelPicker, AiCreditStatus } from '@/components/uicustom/ai/CreditModelPicker';
import { useAiCreditConfig, type AiCreditConfig } from '@/hooks/use-ai-credit-config';
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  type AiProvider,
  getProviderDef,
  getDefaultModel,
  inferProviderFromApiKey,
} from "@/lib/ai-models";

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelState = "collapsed" | "lite";
type ViewMode = "widget" | "expanded";

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

const SUGGESTED_PROMPTS = [
  "What can I do here?",
  "How do live polls work?",
  "How do I create a poll?",
  "Which AI models are available?",
];

// ─── Sensitive data detection ─────────────────────────────────────────────────

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

// (Anon chat history is intentionally not persisted — the landing chat starts
// fresh on every page load.)


interface LandingChatWidgetProps {
  isLoggedIn: boolean;
  userId: string | null;
  /** Start with the inline panel open (default: collapsed to the "Ask AI" bar so
   *  the hero title stays the only focal point). */
  defaultOpen?: boolean;
}

export default function LandingChatWidget({
  isLoggedIn,
  userId: _userId,
  defaultOpen = false,
}: LandingChatWidgetProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { config: creditConfig, error: creditError } = useAiCreditConfig();
  const [provider, setProvider] = useState<AiProvider>("GOOGLE");
  const [model, setModel] = useState<string>("gemini-2.5-flash-lite");
  const [viewMode, setViewMode] = useState<ViewMode>("widget");
  const [showLongMsgGate, setShowLongMsgGate] = useState(false);
  const [sensitiveBanner, setSensitiveBanner] = useState<string[] | null>(null);
  const [lastCostTier, setLastCostTier] = useState<
    "free" | "premium" | "byok" | null
  >(null);

  // ── BYOK state ──────────────────────────────────────────────────────────
  const [byokKey, setByokKey] = useState("");
  const [byokRemember, setByokRemember] = useState(false);
  const [showByokPanel, setShowByokPanel] = useState(false);
  const detectedByokProvider = useMemo(
    () => inferProviderFromApiKey(byokKey),
    [byokKey]
  );
  const activeProvider = detectedByokProvider ?? provider;
  const byokActive =
    byokKey.trim().length >= 8 && detectedByokProvider !== null;

  // Auto-set model to default when provider changes
  const handleSelectModel = useCallback(
    (newProvider: AiProvider, newModel: string) => {
      setProvider(newProvider);
      setModel(newModel);
    },
    []
  );

  // When BYOK key changes, auto-sync provider + model
  const handleByokKeyChange = useCallback(
    (newKey: string) => {
      setByokKey(newKey);
      const detected = inferProviderFromApiKey(newKey);
      if (detected && detected !== provider) {
        setProvider(detected);
        const def = getDefaultModel(detected);
        if (def) setModel(def.value);
      }
    },
    [provider]
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const expandTriggerRef = useRef<HTMLButtonElement | null>(null);

  // The landing chat intentionally starts fresh on every page load — we do NOT
  // restore previous messages from localStorage. Clear any history left over
  // from older builds so a refresh always begins a brand-new conversation.
  useEffect(() => {
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  }, []);

  // Follow replies, not an empty panel: its welcome heading must stay visible.
  useEffect(() => {
    if (state.messages.length === 0) return;
    const el = messagesEndRef.current;
    if (!el) return;
    const container = el.closest(".overflow-y-auto");
    if (container)
      container.scrollTo({
        top: container.scrollHeight,
        behavior: reduceMotion ? "auto" : "smooth",
      });
  }, [state.messages, reduceMotion]);

  // Focus input when panel opens
  useEffect(() => {
    if (state.panel === "lite")
      setTimeout(
        () => inputRef.current?.focus({ preventScroll: true }),
        100
      );
  }, [state.panel]);

  const handleOpen = useCallback(() => dispatch({ type: "OPEN" }), []);
  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    if (viewMode === "expanded") {
      setViewMode("widget");
    } else {
      dispatch({ type: "CLOSE" });
    }
  }, [viewMode]);

  const handleExpand = useCallback((trigger?: HTMLButtonElement) => {
    if (viewMode === "widget") {
      expandTriggerRef.current = trigger ?? null;
      setViewMode("expanded");
    } else {
      // From expanded → go to full chat route
      if (state.sessionId) {
        router.push(`/ai/${state.sessionId}`);
      } else {
        router.push("/ai");
      }
    }
  }, [router, state.sessionId, viewMode]);

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
      modelUsed?: string
    ) => {
      try {
        await fetch(`/api/ai-chat/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage: userContent,
            assistantMessage: aiContent,
            providerUsed: providerUsed ?? "GOOGLE",
            modelUsed: modelUsed ?? "gemini-2.5-flash-lite",
          }),
        });
      } catch {
        /* ignore persistence errors */
      }
    },
    []
  );

  const handleSend = useCallback(async () => {
    const trimmed = state.input.trim();
    if (!trimmed || state.isStreaming) return;

    if (!isLoggedIn && trimmed.length > ANON_MAX_LENGTH) {
      setShowLongMsgGate(true);
      return;
    }

    const sensitiveTypes = detectClientSensitive(trimmed);
    if (sensitiveTypes.length > 0) setSensitiveBanner(sensitiveTypes);

    const userMsgId = genId();
    const userMsg: Message = {
      id: userMsgId,
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    dispatch({ type: "ADD_USER_MSG", msg: userMsg });

    let sessionId = state.sessionId;
    if (isLoggedIn && !sessionId) {
      sessionId = await createSession();
      if (sessionId) dispatch({ type: "SET_SESSION", id: sessionId });
    }

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
          requestId: crypto.randomUUID(),
          sessionId,
          provider: activeProvider,
          model,
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

      const serverSensitive = res.headers.get("X-Sensitive-Types");
      if (serverSensitive) {
        responseSensitiveTypes = serverSensitive.split(",").filter(Boolean);
        setSensitiveBanner((prev) => [
          ...(prev ?? []),
          ...responseSensitiveTypes.filter((t) => !prev?.includes(t)),
        ]);
      }

      // Read cost tier from response headers for UI hints
      const responseCostTier = res.headers.get("X-Ai-Cost-Tier");
      if (responseCostTier === "premium") {
        setLastCostTier("premium");
      } else {
        setLastCostTier(responseCostTier as "free" | "premium" | "byok" | null);
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          if (errData.resetAt)
            dispatch({ type: "SET_RATE_LIMIT", resetAt: errData.resetAt });
          else
            dispatch({
              type: "SET_ERROR",
              error: errData.message ?? "Rate limit reached.",
            });
          return;
        }
        const errorMessage =
          errData.message ??
          (errData.error === "AI_NOT_CONFIGURED"
            ? "AI chat isn't configured yet. Sign in to use your own key."
            : errData.error === "BYOK_REQUIRED"
              ? `To use ${errData.provider ?? "this provider"}, paste your API key above.`
              : errData.error === "PREMIUM_REQUIRED"
                ? `${errData.provider ?? "This model"} requires Premium AI credits. Purchase credits or use a free model.`
                : errData.error === "CREDITS_EXHAUSTED"
                  ? "Your credits are used up. Purchase more or switch to a free model."
                  : errData.error === "QUOTA_EXCEEDED"
                    ? "Daily limit reached. Purchase credits, add your own key, or use a free model."
                    : errData.error === "CONVERSATION_SUSPENDED"
                      ? "This conversation has been suspended."
                      : errData.error === "BLOCKED"
                        ? "Message blocked by safety filter. Please rephrase."
                        : "Something went wrong. Please try again.");
        dispatch({ type: "SET_ERROR", error: errorMessage });
        return;
      }

      fullAiContent = await readChatStream(res, text => {
        fullAiContent += text;
        dispatch({ type: 'APPEND_CHUNK', id: assistantId, text });
      });

      dispatch({ type: "STREAM_DONE" });

      if (isLoggedIn && sessionId && fullAiContent) {
        saveMessagePair(
          sessionId,
          trimmed,
          fullAiContent,
          [...sensitiveTypes, ...responseSensitiveTypes],
          activeProvider,
          model
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      dispatch({ type: "SET_ERROR", error: "Connection lost. Try again." });
    } finally {
      dispatch({ type: 'STREAM_DONE' });
      window.dispatchEvent(new Event('ai-credit:refresh'));
    }
  }, [
    state.input,
    state.isStreaming,
    state.messages,
    state.sessionId,
    isLoggedIn,
    activeProvider,
    model,
    byokActive,
    byokKey,
    byokRemember,
    detectedByokProvider,
    createSession,
    saveMessagePair,
  ]);

  const [desktopOpen, setDesktopOpen] = useState(defaultOpen);

  // Shared props for ChatPanelInner
  const panelProps = {
    state,
    creditConfig,
    creditError,
    dispatch,
    provider,
    model,
    isLoggedIn,
    sensitiveBanner,
    setSensitiveBanner,
    showLongMsgGate,
    setShowLongMsgGate,
    messagesEndRef,
    inputRef,
    reduceMotion: !!reduceMotion,
    onSend: handleSend,
    onClose: handleClose,
    onExpand: handleExpand,
    onSuggest: (text: string) => {
      dispatch({ type: "SET_INPUT", value: text });
      setTimeout(
        () => inputRef.current?.focus({ preventScroll: true }),
        0
      );
    },
    byokKey,
    setByokKey: handleByokKeyChange,
    byokRemember,
    setByokRemember,
    showByokPanel,
    setShowByokPanel,
    byokActive,
    detectedByokProvider,
    activeProvider,
    onSelectModel: handleSelectModel,
    viewMode,
    lastCostTier,
  };

  return (
    <>
      {/* ═══════ EXPANDED MODAL OVERLAY ═══════ */}
      <Dialog open={viewMode === "expanded"} onOpenChange={open => { if (!open) handleClose(); }}>
        <DialogContent accessibleTitle="AI chat expanded" aria-describedby={undefined} hideCloseButton
          className="flex h-[85dvh] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl p-0 motion-reduce:animate-none"
          onCloseAutoFocus={event => {
            event.preventDefault();
            requestAnimationFrame(() => {
              // The inline panel remounts after the dialog closes, so the
              // original trigger can be detached. Focus its visible successor.
              const trigger = expandTriggerRef.current?.isConnected ? expandTriggerRef.current :
                Array.from(document.querySelectorAll<HTMLButtonElement>('[data-landing-chat-expand]')).find(button => button.getClientRects().length > 0);
              trigger?.focus({ preventScroll: true });
            });
          }}>
          <ChatPanelInner {...panelProps} desktopMode />
        </DialogContent>
      </Dialog>

      {/* ═══════ DESKTOP / PORTRAIT ═══════ */}
      {viewMode === "widget" && (
        <div className="flex flex-col items-center w-full px-4 pb-6 pt-4">
          <AnimatePresence mode="wait" initial={false}>
            {desktopOpen ? (
              <motion.div
                key="desktop-panel"
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.2,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="w-full max-w-2xl flex flex-col glass-panel rounded-2xl shadow-2xl shadow-black/20 chat-desktop-panel"
                style={{ height: state.messages.length ? "clamp(360px, 48dvh, 560px)" : "auto" }}
                role="complementary"
                aria-label="AI chat"
              >
                <ChatPanelInner {...panelProps} desktopMode />
              </motion.div>
            ) : (
              <motion.button
                key="desktop-collapsed"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
                onClick={() => setDesktopOpen(true)}
                className="group flex w-full max-w-xl items-center gap-3 rounded-full border border-border/60 bg-surface-1/75 px-5 py-3 text-left shadow-e1 backdrop-blur-xl transition-[border-color,box-shadow,transform,background-color] duration-300 ease-out hover:border-brand-accent/40 hover:bg-surface-1/90 hover:shadow-[0_8px_30px_-12px_hsl(var(--brand-accent)/0.5)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="text-lg text-brand-accent transition-transform duration-300 motion-safe:group-hover:scale-110">
                  ✦
                </span>
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium text-foreground">
                    Ask AI
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    Tap to expand
                  </span>
                </div>
                {state.messages.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-accent text-[10px] font-bold text-brand-accent-foreground">
                    {state.messages.filter((m) => m.role === "user").length}
                  </span>
                )}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted-foreground transition-transform duration-300 motion-safe:group-hover:translate-y-0.5"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Chat Panel Inner ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

interface ChatPanelInnerProps {
  state: WidgetState;
  creditConfig: AiCreditConfig | null;
  creditError: boolean;
  dispatch: React.Dispatch<WidgetAction>;
  provider: AiProvider;
  model: string;
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
  onExpand: (trigger?: HTMLButtonElement) => void;
  onSuggest: (text: string) => void;
  desktopMode?: boolean;
  // BYOK
  byokKey: string;
  setByokKey: (v: string) => void;
  byokRemember: boolean;
  setByokRemember: (v: boolean) => void;
  showByokPanel: boolean;
  setShowByokPanel: (v: boolean) => void;
  byokActive: boolean;
  detectedByokProvider: AiProvider | null;
  activeProvider: AiProvider;
  // Model
  onSelectModel: (provider: AiProvider, model: string) => void;
  viewMode: ViewMode;
  // Cost
  lastCostTier: "free" | "premium" | "byok" | null;
}

function ChatPanelInner({
  state,
  creditConfig,
  creditError,
  dispatch,
  provider,
  model,
  isLoggedIn,
  sensitiveBanner,
  setSensitiveBanner,
  showLongMsgGate,
  setShowLongMsgGate,
  messagesEndRef,
  inputRef,
  reduceMotion,
  onSend,
  onClose,
  onExpand,
  onSuggest,
  desktopMode = false,
  byokKey,
  setByokKey,
  byokRemember,
  setByokRemember,
  showByokPanel,
  setShowByokPanel,
  byokActive,
  detectedByokProvider,
  activeProvider,
  onSelectModel,
  viewMode,
  lastCostTier,
}: ChatPanelInnerProps) {
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
    },
    [onSend]
  );

  const providerDef = getProviderDef(activeProvider);

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-3 py-2.5 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-brand-accent">✦</span>
          <span className="text-sm font-semibold">Ask AI</span>
          {!isLoggedIn && (
            <span
              className="text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5"
              title="Bounded free AI preview. Sign in for more models."
            >
              Free preview
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1">
          {/* BYOK toggle */}
          {isLoggedIn && !creditConfig?.demo && (
            <button
              onClick={() => setShowByokPanel(!showByokPanel)}
              className={`grid size-11 shrink-0 place-items-center rounded-lg transition-colors ${
                byokActive
                  ? "bg-brand-accent/15 text-brand-accent border border-brand-accent/30"
                  : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
              title={
                byokActive
                  ? `Using your ${providerDef?.label ?? activeProvider} key`
                  : "Bring your own API key — use any model"
              }
              aria-label="Toggle BYOK panel"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </button>
          )}
          {/* Expand */}
          <button
            onClick={event => onExpand(event.currentTarget)}
            className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            title={
              viewMode === "widget"
                ? "Expand to larger view"
                : "Open full chat page"
            }
            aria-label={
              viewMode === "widget" ? "Expand chat" : "Go to full chat"
            }
            data-landing-chat-expand={viewMode === "widget" ? '' : undefined}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {viewMode === "widget" ? (
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              ) : (
                <>
                  <path d="M18 13v6H5V6h6" />
                  <path d="M15 3h6v6M10 14L21 3" />
                </>
              )}
            </svg>
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close chat"
            title={
              viewMode === "expanded" ? "Back to widget" : "Close chat"
            }
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
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
            <div className="px-4 py-3 border-b border-border/60 bg-muted/20 space-y-2.5">
              {/* Title row */}
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                  {byokActive ? (
                    <>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-accent animate-pulse" />
                      {providerDef?.emoji} {providerDef?.label ?? activeProvider}{" "}
                      connected
                    </>
                  ) : (
                    <>🔑 Bring your own key</>
                  )}
                </p>
                <button
                  onClick={() => setShowByokPanel(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  title="Close BYOK panel"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Key input */}
              <div className="relative">
                <input
                  value={byokKey}
                  onChange={(e) => setByokKey(e.target.value)}
                  type="password"
                  placeholder="Paste your API key…"
                  className="w-full h-8 bg-muted/40 border border-border rounded-lg text-xs font-mono placeholder:font-sans px-2.5 pr-8 text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-brand-accent/40 transition-colors"
                  autoComplete="off"
                />
                {byokKey.trim() && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {byokActive ? (
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-accent/20"
                        title="Valid key detected"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-brand-accent"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                    ) : (
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20"
                        title="Key format not recognised — try a different provider"
                      >
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-amber-400"
                        >
                          <path d="M12 9v4M12 17h.01" />
                        </svg>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Detection hint */}
              {byokKey.trim() && detectedByokProvider && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] text-brand-accent bg-brand-accent/10 border border-brand-accent/20 rounded-full px-2 py-0.5">
                    ✓ {providerDef?.emoji} {providerDef?.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    Auto-detected from key prefix
                  </span>
                </div>
              )}
              {byokKey.trim() && !detectedByokProvider && (
                <p className="text-[10px] text-amber-400/80">
                  Key prefix not recognised. Supported: OpenAI (sk-), Anthropic
                  (sk-ant-), Google (AIza), Groq (gsk_), xAI (xai-), OpenRouter
                  (sk-or-)
                </p>
              )}

              {/* Actions row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {byokActive ? (
                    <button
                      onClick={() => {
                        setByokKey("");
                        setShowByokPanel(false);
                      }}
                      className="h-6 px-2.5 rounded-md bg-red-500/10 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (byokActive) setShowByokPanel(false);
                      }}
                      disabled={!byokKey.trim()}
                      className={`h-6 px-2.5 rounded-md text-[10px] font-medium transition-colors ${
                        byokKey.trim()
                          ? "bg-brand-accent/15 text-brand-accent hover:bg-brand-accent/25"
                          : "bg-muted/40 text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      Connect
                    </button>
                  )}
                  <a
                    href={
                      providerDef?.getKeyUrl ??
                      getProviderDef(provider)?.getKeyUrl ??
                      "#"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-brand-accent/70 hover:text-brand-accent-light transition-colors"
                    title={`Get an API key from ${providerDef?.label ?? provider}`}
                  >
                    Get a key ↗
                  </a>
                </div>
                <label
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                  title="Save this key to your account for future use"
                >
                  <input
                    type="checkbox"
                    checked={byokRemember}
                    onChange={(e) => setByokRemember(e.target.checked)}
                    className="h-3 w-3 rounded border-border accent-brand-accent"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Save key
                  </span>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sensitive data warning ── */}
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
                Your message may contain {sensitiveBanner.join(" and ")} data.
                Avoid sharing personal details.
              </span>
              <button
                onClick={() => setSensitiveBanner(null)}
                className="shrink-0 text-amber-400 hover:text-amber-200 leading-none"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3 min-h-0">
        {state.messages.length === 0 ? (
          <div className="flex min-h-24 items-center justify-center py-6 text-center">
            <h2 className="text-xl font-medium tracking-tight sm:text-2xl">What’s on your mind?</h2>
          </div>
        ) : (
          <>
            {state.messages
              .filter(
                (msg) => !(msg.role === "assistant" && msg.content === "")
              )
              .map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  reduceMotion={reduceMotion}
                />
              ))}
            {state.isStreaming &&
              state.messages[state.messages.length - 1]?.role ===
                "assistant" &&
              state.messages[state.messages.length - 1]?.content === "" && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-brand-accent/20 border border-brand-accent/30 flex items-center justify-center text-[10px] text-brand-accent shrink-0">
                      ✦
                    </div>
                    <div className="bg-muted/40 border border-border/60 rounded-2xl px-3 py-2">
                      <TypingIndicator />
                    </div>
                  </div>
                </div>
              )}
          </>
        )}
        {state.messages.length > 0 && <div ref={messagesEndRef} />}
      </div>

      {/* ── Error banner ── */}
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
              <button
                onClick={() => dispatch({ type: "CLEAR_ERROR" })}
                className="shrink-0 hover:text-red-200"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Long message gate ── */}
      <AnimatePresence>
        {showLongMsgGate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="flex flex-col gap-2 px-4 py-3 bg-brand-accent/10 border-t border-brand-accent/20 text-xs">
              <span className="text-brand-accent-light">
                Longer messages need an account — free, takes 10 seconds.
              </span>
              <div className="flex gap-2">
                <a
                  href="/auth/login"
                  className="flex-1 text-center py-1.5 rounded-lg bg-brand-accent text-brand-accent-foreground text-xs font-semibold hover:bg-brand-accent transition-colors"
                >
                  Sign in
                </a>
                <button
                  onClick={() => setShowLongMsgGate(false)}
                  className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="shrink-0 px-3 pb-3">
        <ChatComposer value={state.input} onChange={value => { dispatch({ type: 'SET_INPUT', value }); if (value.length <= ANON_MAX_LENGTH) setShowLongMsgGate(false); }}
          onSend={onSend} busy={state.isStreaming}
          toolbar={<CreditModelPicker provider={provider} model={model} config={creditConfig} error={creditError}
            byokProvider={byokActive && !creditConfig?.demo ? detectedByokProvider : null} onSelect={onSelectModel} disabled={state.isStreaming} />}
          guidance={!isLoggedIn ? 'Free preview · sign in for more models' : <span>{byokActive ? 'Your key' : `${creditConfig?.models.find(item => item.provider === provider && item.model === model)?.credits ?? '…'} credits / message`}</span>} />
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  reduceMotion,
}: {
  msg: Message;
  reduceMotion: boolean;
}) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.15 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="mr-2 mt-1 shrink-0 h-5 w-5 rounded-full bg-brand-accent/20 border border-brand-accent/30 flex items-center justify-center text-[10px] text-brand-accent">
          ✦
        </div>
      )}
      <div
        className={`min-w-0 rounded-2xl px-3 py-2 text-base leading-7 [overflow-wrap:anywhere] ${
          isUser
            ? "max-w-[85%] bg-muted whitespace-pre-wrap text-foreground"
            : "flex-1 text-foreground"
        }`}
      >
        {isUser ? msg.content : <MessageContent content={msg.content} />}
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
