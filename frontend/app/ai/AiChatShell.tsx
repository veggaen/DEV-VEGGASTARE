"use client";

/**
 * @fileOverview AiChatShell — the two-pane chat app shell for /ai/*. A conversation
 *   rail (left) wraps the active chat thread (right child), so /ai and /ai/[id]
 *   share ONE cohesive interface instead of being two separate full pages
 *   (ChatGPT/Claude/Discord pattern).
 *
 *   Two layouts, switchable from settings (prefs.aiChatLayout):
 *     - "persistent": the rail is always docked on the left (desktop).
 *     - "overlay":    the chat is full-width; the rail slides in as a drawer.
 *   On mobile both behave as a drawer.
 *
 *   The rail owns: search, New chat, active highlight, inline rename (PATCH
 *   /api/ai-chat/sessions/[id]), and delete. It refreshes on a window event
 *   ("ai-chat:sessions-changed") that the chat page dispatches after create/send.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiCheck, FiX, FiMenu, FiMessageSquare } from "react-icons/fi";
import { cn } from "@/lib/utils";
import { useUiPreferences } from "@/components/providers/ui-preferences";
import { useConfirm } from "@/components/providers/confirm-dialog";

interface ShellSession {
  id: string;
  title: string;
  updatedAt: string;
  _count?: { messages: number };
}

const RAIL_W = "18rem";

export function AiChatShell({
  isLoggedIn,
  children,
}: {
  isLoggedIn: boolean;
  children: React.ReactNode;
}) {
  const { prefs } = useUiPreferences();
  const overlay = prefs.aiChatLayout === "overlay";
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const confirm = useConfirm();

  const [sessions, setSessions] = React.useState<ShellSession[]>([]);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  // Drawer open state (used in overlay mode + on mobile).
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // The id in the URL (/ai/<id>) — drives the active highlight.
  const activeId = React.useMemo(() => {
    const m = pathname.match(/^\/ai\/([^/]+)/);
    return m?.[1] ?? null;
  }, [pathname]);

  const load = React.useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch("/api/ai-chat/sessions?limit=50");
      if (res.ok) setSessions((await res.json()).sessions ?? []);
    } catch { /* keep stale list */ }
  }, [isLoggedIn]);

  React.useEffect(() => { void load(); }, [load]);
  // The chat page tells us when to refresh (after create / first send / title change).
  React.useEffect(() => {
    const onChanged = () => void load();
    window.addEventListener("ai-chat:sessions-changed", onChanged);
    return () => window.removeEventListener("ai-chat:sessions-changed", onChanged);
  }, [load]);
  // Close the drawer whenever the route changes (picked a chat).
  React.useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const newChat = React.useCallback(async () => {
    if (!isLoggedIn) { router.push("/auth/login"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/ai-chat/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (res.ok) {
        const data = await res.json();
        await load();
        router.push(`/ai/${data.id}`);
      }
    } finally { setCreating(false); }
  }, [isLoggedIn, router, load]);

  const rename = React.useCallback(async (id: string, title: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s))); // optimistic
    try {
      await fetch(`/api/ai-chat/sessions/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch { void load(); }
  }, [load]);

  const remove = React.useCallback(async (id: string) => {
    if (!(await confirm({ title: "Delete this conversation?", confirmLabel: "Delete", destructive: true }))) return;
    setSessions((prev) => prev.filter((s) => s.id !== id)); // optimistic
    try { await fetch(`/api/ai-chat/sessions/${id}`, { method: "DELETE" }); } catch { void load(); }
    if (activeId === id) router.push("/ai");
  }, [activeId, router, load, confirm]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sessions.filter((s) => s.title.toLowerCase().includes(q)) : sessions;
  }, [sessions, query]);

  const rail = (
    <AiChatRail
      sessions={filtered}
      activeId={activeId}
      creating={creating}
      query={query}
      onQuery={setQuery}
      onNewChat={newChat}
      onRename={rename}
      onRemove={remove}
      total={sessions.length}
    />
  );

  // Persistent (desktop): rail docked. Overlay or mobile: rail is a drawer.
  const docked = !overlay;

  return (
    <div className="relative flex h-[calc(100dvh-var(--app-header-offset,64px))] overflow-hidden">
      {/* Docked rail — desktop only, persistent mode */}
      {docked && (
        <aside
          className="hidden md:flex shrink-0 flex-col border-r border-black/5 dark:border-white/8 bg-background/60 backdrop-blur-sm"
          style={{ width: RAIL_W }}
        >
          {rail}
        </aside>
      )}

      {/* Drawer rail — overlay mode (all sizes) + mobile (always) */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="fixed left-0 z-50 flex flex-col border-r border-black/10 dark:border-white/10 bg-background shadow-2xl"
              // Start BELOW the global sticky topbar (not at viewport top) so the
              // drawer never overlaps the app header.
              style={{
                width: RAIL_W,
                top: "var(--app-header-offset, 64px)",
                height: "calc(100dvh - var(--app-header-offset, 64px))",
              }}
              initial={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              {rail}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Chat thread (right). Floating menu button opens the drawer when the rail
          isn't docked: always in overlay mode, mobile-only in persistent mode. */}
      <div className="relative flex-1 min-w-0">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open conversations"
          className={cn(
            "absolute left-3 top-3 z-30 grid place-items-center h-9 w-9 rounded-full bg-background/80 backdrop-blur border border-black/8 dark:border-white/10 text-muted-foreground hover:text-foreground transition-colors",
            docked && "md:hidden", // persistent mode: rail is docked on desktop, so hide there
          )}
        >
          <FiMenu className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function AiChatRail({
  sessions, activeId, creating, query, onQuery, onNewChat, onRename, onRemove, total,
}: {
  sessions: ShellSession[];
  activeId: string | null;
  creating: boolean;
  query: string;
  onQuery: (v: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
  total: number;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header: New chat */}
      <div className="p-3 pb-2">
        <button
          onClick={onNewChat}
          disabled={creating}
          className="group w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-black text-sm font-semibold px-4 py-2.5 hover:bg-emerald-400 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20"
        >
          {creating
            ? <span className="h-4 w-4 rounded-full border-2 border-black/40 border-t-transparent animate-spin" />
            : <FiPlus className="h-4 w-4 transition-transform group-hover:rotate-90" />}
          New chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search chats…"
            className="w-full rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/8 pl-9 pr-3 py-2 text-sm outline-none focus:border-emerald-500/40 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overscroll-contain-y px-2 pb-3 min-h-0">
        {sessions.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            {query ? "No chats match." : "No conversations yet."}
          </p>
        ) : (
          <div className="space-y-0.5">
            {sessions.map((s) => (
              <RailRow
                key={s.id}
                session={s}
                active={s.id === activeId}
                onRename={onRename}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-black/5 dark:border-white/8 text-[10px] uppercase tracking-wider text-muted-foreground">
        {total} conversation{total !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

/** One conversation row with inline rename + delete. */
function RailRow({
  session: s, active, onRename, onRemove,
}: {
  session: ShellSession;
  active: boolean;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(s.title);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== s.title) onRename(s.id, t);
    else setDraft(s.title);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-black/5 dark:bg-white/8">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(s.title); setEditing(false); } }}
          onBlur={commit}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none"
        />
        <button onClick={commit} aria-label="Save" className="shrink-0 grid place-items-center h-6 w-6 rounded text-emerald-500 hover:bg-emerald-500/15">
          <FiCheck className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { setDraft(s.title); setEditing(false); }} aria-label="Cancel" className="shrink-0 grid place-items-center h-6 w-6 rounded text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10">
          <FiX className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/row relative flex items-center gap-2 rounded-lg pl-2.5 pr-1 py-1.5 transition-colors",
        active ? "bg-emerald-500/12 text-foreground" : "hover:bg-black/5 dark:hover:bg-white/8",
      )}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-emerald-500" />}
      <FiMessageSquare className={cn("h-3.5 w-3.5 shrink-0", active ? "text-emerald-500" : "text-muted-foreground/60")} />
      <Link href={`/ai/${s.id}`} className="min-w-0 flex-1 text-sm truncate py-0.5">
        {s.title || "Untitled"}
      </Link>
      {/* Hover actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
        <button
          onClick={() => { setDraft(s.title); setEditing(true); }}
          aria-label="Rename"
          className="grid place-items-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10"
        >
          <FiEdit2 className="h-3 w-3" />
        </button>
        <button
          onClick={() => onRemove(s.id)}
          aria-label="Delete"
          className="grid place-items-center h-6 w-6 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/15"
        >
          <FiTrash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
