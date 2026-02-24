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
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  type AiProvider,
  type AiModelOption,
  type AiModelCapability,
  AI_PROVIDERS,
  CAPABILITY_BADGES,
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
  } catch {
    /* quota exceeded — ignore */
  }
}

// ─── Capability Badge component ───────────────────────────────────────────────

function CapBadge({ cap }: { cap: AiModelCapability }) {
  const b = CAPABILITY_BADGES[cap];
  if (!b) return null;
  // Only "flagship" gets a colored highlight; everything else is muted
  const isHot = cap === "flagship";
  return (
    <span
      className={`inline-flex items-center text-[9px] leading-none px-1.5 py-0.5 rounded-full border ${
        isHot
          ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
          : "bg-white/3 text-muted-foreground/50 border-white/6"
      }`}
      title={b.tip}
    >
      {b.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Model Selector Popover ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

interface ModelSelectorProps {
  provider: AiProvider;
  model: string;
  byokActive: boolean;
  detectedByokProvider: AiProvider | null;
  isLoggedIn: boolean;
  onSelectModel: (provider: AiProvider, model: string) => void;
  onOpenByok: () => void;
  compact?: boolean;
}

const DROPDOWN_W = 320; // matches w-80 = 20rem = 320px

function calcDropdownPos(triggerEl: HTMLElement) {
  const rect = triggerEl.getBoundingClientRect();
  let left = rect.right - DROPDOWN_W;
  if (left < 8) left = 8;
  if (left + DROPDOWN_W > window.innerWidth - 8)
    left = window.innerWidth - DROPDOWN_W - 8;
  return { top: rect.bottom + 6, left };
}

function ModelSelector({
  provider, model, byokActive, detectedByokProvider, isLoggedIn,
  onSelectModel, onOpenByok, compact = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedLegacy, setExpandedLegacy] = useState<AiProvider | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Toggle + compute position synchronously (batched with setOpen — no flash)
  const handleToggle = useCallback(() => {
    if (!isLoggedIn) return;
    if (!open && triggerRef.current) {
      setPos(calcDropdownPos(triggerRef.current));
    }
    setOpen((prev) => !prev);
  }, [isLoggedIn, open]);

  // Close on click outside (checks both trigger and portal dropdown)
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open]);

  // Re-anchor dropdown on scroll / resize so it stays pinned to the trigger
  useEffect(() => {
    if (!open) return;
    function reanchor() {
      if (triggerRef.current) setPos(calcDropdownPos(triggerRef.current));
    }
    window.addEventListener("scroll", reanchor, true); // capture phase for nested scrollers
    window.addEventListener("resize", reanchor);
    return () => {
      window.removeEventListener("scroll", reanchor, true);
      window.removeEventListener("resize", reanchor);
    };
  }, [open]);

  const activeProviderDef = getProviderDef(
    byokActive && detectedByokProvider ? detectedByokProvider : provider
  );
  const activeModel =
    activeProviderDef?.models.find((m) => m.value === model) ??
    activeProviderDef?.models.find((m) => m.isDefault) ??
    activeProviderDef?.models[0];

  // Separate providers by tier
  const freeProviders = AI_PROVIDERS.filter((p) => p.tier === "free");
  const premiumProviders = AI_PROVIDERS.filter((p) => p.tier === "premium");
  const byokProviders = AI_PROVIDERS.filter((p) => p.tier === "byok-only");

  // Filter by search
  const matchesSearch = (text: string) =>
    !search || text.toLowerCase().includes(search.toLowerCase());

  return (
    <>
      {/* Trigger pill */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        disabled={!isLoggedIn}
        className={`flex items-center gap-1.5 text-[11px] rounded-lg border transition-all ${
          isLoggedIn
            ? "cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-500/5"
            : "cursor-default opacity-70"
        } ${
          byokActive
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-black/12 dark:border-white/10 text-muted-foreground"
        } px-2 py-1`}
        title={isLoggedIn ? "Choose AI model" : "Sign in to choose a model"}
      >
        <span>{activeProviderDef?.emoji}</span>
        <span className="font-medium truncate max-w-30">
          {compact
            ? (activeModel?.label ?? "Model")
            : (activeModel?.label ?? activeProviderDef?.label ?? "Model")}
        </span>
        {byokActive && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0"
            title="Using your API key"
          />
        )}
        {isLoggedIn && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 opacity-60"
          >
            <path d={open ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
          </svg>
        )}
      </button>

      {/* Dropdown — rendered via portal to escape overflow:hidden ancestors */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                className="fixed z-200 w-80 max-h-[min(420px,70vh)] overflow-hidden rounded-xl border border-white/10 bg-[#0f0f14]/98 backdrop-blur-xl shadow-2xl shadow-black/40 flex flex-col"
                style={{ top: pos.top, left: pos.left }}
              >
            {/* Search */}
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models…"
                  className="w-full h-8 bg-white/5 border border-white/8 rounded-lg text-xs pl-8 pr-3 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-emerald-500/30"
                  autoFocus
                />
              </div>
            </div>

            {/* Scrollable model list */}
            <div
              className="flex-1 overflow-y-auto px-2 pb-2 space-y-1"
              style={{ scrollbarWidth: "thin" }}
            >
              {/* ── Free tier providers ── */}
              {freeProviders.map((prov) => {
                const recommended = prov.models.filter(
                  (m) =>
                    m.group !== "legacy" &&
                    matchesSearch(
                      m.label + (m.description ?? "") + prov.label
                    )
                );
                const legacy = prov.models.filter(
                  (m) =>
                    m.group === "legacy" &&
                    matchesSearch(
                      m.label + (m.description ?? "") + prov.label
                    )
                );
                if (recommended.length === 0 && legacy.length === 0)
                  return null;
                return (
                  <div key={prov.value}>
                    <div className="flex items-center justify-between px-2 pt-2 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        {prov.emoji} {prov.label}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        FREE
                      </span>
                    </div>
                    {recommended.map((m) => (
                      <ModelRow
                        key={m.value}
                        model={m}
                        providerEmoji={prov.emoji}
                        isActive={prov.value === provider && m.value === model}
                        onClick={() => {
                          onSelectModel(prov.value, m.value);
                          setOpen(false);
                          setSearch("");
                        }}
                      />
                    ))}
                    {legacy.length > 0 && (
                      <LegacyToggle
                        count={legacy.length}
                        expanded={expandedLegacy === prov.value}
                        onToggle={() =>
                          setExpandedLegacy(
                            expandedLegacy === prov.value ? null : prov.value
                          )
                        }
                      />
                    )}
                    {expandedLegacy === prov.value &&
                      legacy.map((m) => (
                        <ModelRow
                          key={m.value}
                          model={m}
                          providerEmoji={prov.emoji}
                          isActive={
                            prov.value === provider && m.value === model
                          }
                          onClick={() => {
                            onSelectModel(prov.value, m.value);
                            setOpen(false);
                            setSearch("");
                          }}
                        />
                      ))}
                  </div>
                );
              })}

              {/* ── Premium providers (credits or BYOK) ── */}
              {premiumProviders.map((prov) => {
                const isUnlocked =
                  byokActive && detectedByokProvider === prov.value;
                const recommended = prov.models.filter(
                  (m) =>
                    m.group !== "legacy" &&
                    matchesSearch(
                      m.label + (m.description ?? "") + prov.label
                    )
                );
                const legacy = prov.models.filter(
                  (m) =>
                    m.group === "legacy" &&
                    matchesSearch(
                      m.label + (m.description ?? "") + prov.label
                    )
                );
                if (recommended.length === 0 && legacy.length === 0)
                  return null;
                return (
                  <div key={prov.value}>
                    <div className="flex items-center justify-between px-2 pt-3 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        {prov.emoji} {prov.label}
                      </span>
                      {isUnlocked ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/20">
                          YOUR KEY
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          PREMIUM
                        </span>
                      )}
                    </div>
                    {recommended.map((m) => (
                      <ModelRow
                        key={m.value}
                        model={m}
                        providerEmoji={prov.emoji}
                        isActive={prov.value === provider && m.value === model}
                        onClick={() => {
                          onSelectModel(prov.value, m.value);
                          setOpen(false);
                          setSearch("");
                        }}
                      />
                    ))}
                    {legacy.length > 0 && (
                      <LegacyToggle
                        count={legacy.length}
                        expanded={expandedLegacy === prov.value}
                        onToggle={() =>
                          setExpandedLegacy(
                            expandedLegacy === prov.value ? null : prov.value
                          )
                        }
                      />
                    )}
                    {expandedLegacy === prov.value &&
                      legacy.map((m) => (
                        <ModelRow
                          key={m.value}
                          model={m}
                          providerEmoji={prov.emoji}
                          isActive={
                            prov.value === provider && m.value === model
                          }
                          onClick={() => {
                            onSelectModel(prov.value, m.value);
                            setOpen(false);
                            setSearch("");
                          }}
                        />
                      ))}
                  </div>
                );
              })}

              {/* ── BYOK-only providers ── */}
              {byokProviders.map((prov) => {
                const isUnlocked =
                  byokActive && detectedByokProvider === prov.value;
                const recommended = prov.models.filter(
                  (m) =>
                    m.group !== "legacy" &&
                    matchesSearch(
                      m.label + (m.description ?? "") + prov.label
                    )
                );
                const legacy = prov.models.filter(
                  (m) =>
                    m.group === "legacy" &&
                    matchesSearch(
                      m.label + (m.description ?? "") + prov.label
                    )
                );
                if (recommended.length === 0 && legacy.length === 0)
                  return null;
                return (
                  <div key={prov.value}>
                    <div className="flex items-center justify-between px-2 pt-3 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        {prov.emoji} {prov.label}
                      </span>
                      {isUnlocked ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/20">
                          CONNECTED
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            onOpenByok();
                            setOpen(false);
                          }}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1"
                          title={`Add your ${prov.label} API key`}
                        >
                          🔑 Add key
                        </button>
                      )}
                    </div>
                    {recommended.map((m) => (
                      <ModelRow
                        key={m.value}
                        model={m}
                        providerEmoji={prov.emoji}
                        isActive={prov.value === provider && m.value === model}
                        locked={!isUnlocked}
                        onClick={() => {
                          if (isUnlocked) {
                            onSelectModel(prov.value, m.value);
                            setOpen(false);
                            setSearch("");
                          } else {
                            onOpenByok();
                            setOpen(false);
                          }
                        }}
                      />
                    ))}
                    {legacy.length > 0 && (
                      <LegacyToggle
                        count={legacy.length}
                        expanded={expandedLegacy === prov.value}
                        onToggle={() =>
                          setExpandedLegacy(
                            expandedLegacy === prov.value ? null : prov.value
                          )
                        }
                      />
                    )}
                    {expandedLegacy === prov.value &&
                      legacy.map((m) => (
                        <ModelRow
                          key={m.value}
                          model={m}
                          providerEmoji={prov.emoji}
                          isActive={
                            prov.value === provider && m.value === model
                          }
                          locked={!isUnlocked}
                          onClick={() => {
                            if (isUnlocked) {
                              onSelectModel(prov.value, m.value);
                              setOpen(false);
                              setSearch("");
                            } else {
                              onOpenByok();
                              setOpen(false);
                            }
                          }}
                        />
                      ))}
                  </div>
                );
              })}
            </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

function ModelRow({
  model,
  providerEmoji,
  isActive,
  locked,
  onClick,
}: {
  model: AiModelOption;
  providerEmoji: string;
  isActive: boolean;
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group ${
        isActive
          ? "bg-emerald-500/10 border border-emerald-500/20"
          : "hover:bg-white/5 border border-transparent"
      } ${locked ? "opacity-60" : ""}`}
    >
      {/* Active indicator */}
      <div className="mt-1 shrink-0 w-3 flex justify-center">
        {isActive ? (
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        ) : locked ? (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted-foreground/40"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ) : null}
      </div>
      {/* Model info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-foreground truncate">
            {model.label}
          </span>
          {model.contextSize && (
            <span
              className="text-[9px] text-muted-foreground/50"
              title="Context window"
            >
              {model.contextSize}
            </span>
          )}
          {model.isDefault && (
            <span className="text-[9px] text-emerald-400/70">★</span>
          )}
        </div>
        {model.description && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-snug">
            {model.description}
          </p>
        )}
        {model.capabilities && model.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {model.capabilities.map((c) => (
              <CapBadge key={c} cap={c} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function LegacyToggle({
  count,
  expanded,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d={expanded ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
      </svg>
      {expanded ? "Hide" : `${count} legacy model${count > 1 ? "s" : ""}`}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Main Component ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

interface LandingChatWidgetProps {
  isLoggedIn: boolean;
  userId: string | null;
}

export default function LandingChatWidget({
  isLoggedIn,
  userId: _userId,
}: LandingChatWidgetProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [provider, setProvider] = useState<AiProvider>("GOOGLE");
  const [model, setModel] = useState<string>("gemini-2.5-flash");
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

  // Load anon history on mount
  useEffect(() => {
    if (!isLoggedIn) {
      const history = loadAnonHistory();
      if (history.length > 0)
        dispatch({ type: "LOAD_HISTORY", messages: history });
    }
  }, [isLoggedIn]);

  // Persist anon history
  useEffect(() => {
    if (!isLoggedIn && state.messages.length > 0)
      saveAnonHistory(state.messages);
  }, [isLoggedIn, state.messages]);

  // Scroll to bottom
  useEffect(() => {
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

  const handleExpand = useCallback(() => {
    if (viewMode === "widget") {
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
            modelUsed: modelUsed ?? "gemini-2.5-flash",
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
              dispatch({
                type: "APPEND_CHUNK",
                id: assistantId,
                text: parsed.text,
              });
            }
          } catch {
            /* skip malformed chunks */
          }
        }
      }

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

  const [desktopOpen, setDesktopOpen] = useState(true);

  // Shared props for ChatPanelInner
  const panelProps = {
    state,
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
      <AnimatePresence>
        {viewMode === "expanded" && (
          <motion.div
            key="expanded-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleClose();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{
                duration: 0.22,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="w-full max-w-4xl h-[85vh] flex flex-col glass-panel rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
              role="dialog"
              aria-label="AI chat expanded"
            >
              <ChatPanelInner {...panelProps} desktopMode />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ MOBILE (< md landscape) ═══════ */}
      <div className="portrait:hidden md:hidden">
        <AnimatePresence>
          {state.panel === "collapsed" && viewMode === "widget" && (
            <motion.button
              key="chat-bubble"
              initial={{ opacity: 0, scale: 0.8, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 16 }}
              transition={{
                duration: reduceMotion ? 0 : 0.2,
                ease: "easeOut",
              }}
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

        <AnimatePresence>
          {state.panel === "lite" && viewMode === "widget" && (
            <motion.div
              key="chat-panel-mobile"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{
                duration: reduceMotion ? 0 : 0.22,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="fixed bottom-6 right-6 z-50 flex flex-col glass-panel rounded-2xl shadow-2xl shadow-black/30"
              style={{
                width: "min(360px, calc(100vw - 32px))",
                height: "min(520px, calc(100dvh - 160px))",
              }}
              role="dialog"
              aria-label="AI chat"
            >
              <ChatPanelInner {...panelProps} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════ DESKTOP / PORTRAIT ═══════ */}
      {viewMode === "widget" && (
        <div className="hidden portrait:flex md:landscape:flex flex-col items-center w-full px-4 pb-6 pt-4">
          <div className="mb-3 text-center">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground/50">
              Ask AI
            </span>
          </div>
          <AnimatePresence mode="wait">
            {desktopOpen ? (
              <motion.div
                key="desktop-panel"
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.25,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="w-full max-w-2xl flex flex-col glass-panel rounded-2xl shadow-2xl shadow-black/20 chat-desktop-panel"
                style={{ height: "clamp(320px, 42vh, 480px)" }}
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
                className="flex items-center gap-3 px-5 py-3.5 rounded-2xl glass-panel hover:border-emerald-500/30 hover:shadow-emerald-500/10 shadow-lg transition-all group max-w-2xl w-full"
              >
                <span className="text-emerald-400 text-lg group-hover:scale-110 transition-transform">
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
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black">
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
                  className="text-muted-foreground"
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
  onExpand: () => void;
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
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/8 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">✦</span>
          <span className="text-sm font-semibold">Ask AI</span>
          {!isLoggedIn && (
            <span
              className="text-[10px] text-muted-foreground bg-white/5 rounded px-1.5 py-0.5"
              title="Free preview powered by Gemini. Sign in for all models."
            >
              Free preview
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Model selector */}
          <ModelSelector
            provider={provider}
            model={model}
            byokActive={byokActive}
            detectedByokProvider={detectedByokProvider}
            isLoggedIn={isLoggedIn}
            onSelectModel={onSelectModel}
            onOpenByok={() => setShowByokPanel(true)}
            compact={!desktopMode}
          />
          {/* BYOK toggle */}
          {isLoggedIn && (
            <button
              onClick={() => setShowByokPanel(!showByokPanel)}
              className={`p-1.5 rounded-lg transition-colors ${
                byokActive
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "hover:bg-black/6 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground"
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
            onClick={onExpand}
            className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            title={
              viewMode === "widget"
                ? "Expand to larger view"
                : "Open full chat page"
            }
            aria-label={
              viewMode === "widget" ? "Expand chat" : "Go to full chat"
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
            className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
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
            <div className="px-4 py-3 border-b border-black/8 dark:border-white/10 bg-black/2 dark:bg-white/2 space-y-2.5">
              {/* Title row */}
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                  {byokActive ? (
                    <>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
                  className="w-full h-8 bg-black/4 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-xs font-mono placeholder:font-sans px-2.5 pr-8 text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-emerald-500/40 transition-colors"
                  autoComplete="off"
                />
                {byokKey.trim() && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {byokActive ? (
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20"
                        title="Valid key detected"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-emerald-400"
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
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
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
                          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                          : "bg-black/4 dark:bg-white/5 text-muted-foreground cursor-not-allowed"
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
                    className="text-[10px] text-emerald-400/70 hover:text-emerald-300 transition-colors"
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
                    className="h-3 w-3 rounded border-black/20 dark:border-white/20 accent-emerald-500"
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
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {state.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div
              className={`text-emerald-400 ${desktopMode ? "text-4xl" : "text-3xl"}`}
            >
              ✦
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                {isLoggedIn
                  ? byokActive
                    ? `Chat with ${providerDef?.label ?? activeProvider} (your key)`
                    : `Chat with ${getProviderDef(provider)?.label ?? provider}`
                  : "Ask anything about Freedom Store™"}
              </p>
              <p className="text-xs text-muted-foreground max-w-60 mx-auto">
                {isLoggedIn
                  ? "Pick a model above or bring your own key to unlock all providers."
                  : "Free preview powered by Gemini. Sign in to choose from 20+ AI models."}
              </p>
            </div>
            <div
              className={`flex flex-wrap gap-2 justify-center ${desktopMode ? "max-w-lg" : "max-w-70"}`}
            >
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
                    <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-400 shrink-0">
                      ✦
                    </div>
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
            <div className="flex flex-col gap-2 px-4 py-3 bg-emerald-500/10 border-t border-emerald-500/20 text-xs">
              <span className="text-emerald-300">
                Longer messages need an account — free, takes 10 seconds.
              </span>
              <div className="flex gap-2">
                <a
                  href="/sign-in"
                  className="flex-1 text-center py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors"
                >
                  Sign in
                </a>
                <button
                  onClick={() => setShowLongMsgGate(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 text-muted-foreground hover:bg-white/15 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input area ── */}
      <div className="px-3 py-3 border-t border-black/8 dark:border-white/10 shrink-0 chat-input-area">
        {/* Model indicator bar */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <span>{providerDef?.emoji ?? "✦"}</span>
            <span>
              {getProviderDef(activeProvider)?.models.find(
                (m) => m.value === model
              )?.label ?? model}
            </span>
            {byokActive && (
              <span className="text-emerald-400/60">• your key</span>
            )}
            {!byokActive && lastCostTier === "premium" && (
              <span className="text-amber-400/70">• premium credits</span>
            )}
            {!byokActive && lastCostTier === "free" && (
              <span className="text-emerald-400/40">• free</span>
            )}
          </div>
          {!isLoggedIn &&
            state.input.length > ANON_MAX_LENGTH * 0.7 && (
              <span
                className={`text-[10px] ${state.input.length > ANON_MAX_LENGTH ? "text-red-400" : "text-muted-foreground/40"}`}
              >
                {state.input.length}/{ANON_MAX_LENGTH}
              </span>
            )}
        </div>
        <div className="flex items-end gap-2 rounded-xl bg-black/4 dark:bg-white/5 px-3 py-2 border border-black/10 dark:border-white/10 chat-input-wrapper">
          <textarea
            ref={inputRef}
            value={state.input}
            onChange={(e) => {
              dispatch({ type: "SET_INPUT", value: e.target.value });
              if (
                showLongMsgGate &&
                e.target.value.length <= ANON_MAX_LENGTH
              )
                setShowLongMsgGate(false);
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
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
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
        <div className="mr-2 mt-1 shrink-0 h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-400">
          ✦
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word ${
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
