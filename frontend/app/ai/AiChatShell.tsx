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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
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
  isDemo = false,
  children,
}: {
  isLoggedIn: boolean;
  isDemo?: boolean;
  children: React.ReactNode;
}) {
  const { prefs } = useUiPreferences();
  const overlay = prefs.aiChatLayout === "overlay";
  const pathname = usePathname();
  const router = useRouter();
  const confirm = useConfirm();

  const [sessions, setSessions] = React.useState<ShellSession[]>([]);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  // Drawer open state (used in overlay mode + on mobile).
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const lastDrawerOpener = React.useRef<HTMLElement | null>(null);

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
  React.useEffect(() => {
    const open = () => { lastDrawerOpener.current = document.activeElement as HTMLElement; setDrawerOpen(true); };
    window.addEventListener('ai-chat:open-conversations', open);
    return () => window.removeEventListener('ai-chat:open-conversations', open);
  }, []);

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
      } else { const data = await res.json().catch(() => ({})); toast.error(data.message ?? "Could not create a conversation. Please retry."); }
    } catch { toast.error("Connection failed. Please retry."); } finally { setCreating(false); }
  }, [isLoggedIn, router, load]);

  const rename = React.useCallback(async (id: string, title: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s))); // optimistic
    try {
      const response = await fetch(`/api/ai-chat/sessions/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) { toast.error("This conversation could not be renamed."); await load(); }
    } catch { toast.error("Could not save the name."); void load(); }
  }, [load]);

  const remove = React.useCallback(async (id: string) => {
    if (!(await confirm({ title: "Delete this conversation?", confirmLabel: "Delete", destructive: true }))) return;
    setSessions((prev) => prev.filter((s) => s.id !== id)); // optimistic
    try {
      const response = await fetch(`/api/ai-chat/sessions/${id}`, { method: "DELETE" });
      if (!response.ok) { toast.error("This conversation could not be deleted."); await load(); return; }
    } catch { toast.error("Could not delete the conversation."); void load(); return; }
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
      readOnly={isDemo}
    />
  );

  // Persistent (desktop): rail docked. Overlay or mobile: rail is a drawer.
  const docked = !overlay;

  return (
    <div className="relative mx-auto flex h-[calc(100dvh-var(--app-header-offset,64px)-var(--demo-notice-height,0px))] w-full max-w-[1280px] min-h-0 min-w-0 overflow-hidden">
      {docked && <aside className="hidden shrink-0 flex-col border-r border-border bg-background/60 lg:flex" style={{ width: RAIL_W }}>{rail}</aside>}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <div className={cn("shrink-0 border-b border-border px-3 py-1", (activeId || docked) && "lg:hidden", activeId && "hidden")}>
            <SheetTrigger asChild>
              <button type="button" aria-label="Open conversations" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted">
                <FiMenu className="h-4 w-4" /> Conversations
              </button>
            </SheetTrigger>
          </div>
          <SheetContent side="left" accessibleTitle="Conversations" accessibleDescription="Search or start a chat."
            onCloseAutoFocus={event => {
              if (lastDrawerOpener.current) { event.preventDefault(); lastDrawerOpener.current.focus(); lastDrawerOpener.current = null; }
            }}
            className="flex w-[min(22rem,calc(100%-2rem))] max-w-full flex-col p-0 pt-14 pb-[env(safe-area-inset-bottom)]">
            {rail}
          </SheetContent>
        </Sheet>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function AiChatRail({
  sessions, activeId, creating, query, onQuery, onNewChat, onRename, onRemove, total, readOnly,
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
  readOnly: boolean;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header: New chat */}
      <div className="p-3 pb-2">
        <button
          onClick={onNewChat}
          disabled={creating}
          className="group w-full min-h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-black text-sm font-semibold px-4 py-2.5 hover:bg-emerald-400 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20"
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
            aria-label="Search conversations"
            className="w-full rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/8 h-11 pl-9 pr-3 py-2 text-base outline-none focus:border-emerald-500/40 transition-colors"
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
                readOnly={readOnly}
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
  session: s, active, onRename, onRemove, readOnly,
}: {
  session: ShellSession;
  active: boolean;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
  readOnly: boolean;
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
        <button onClick={commit} aria-label="Save" className="shrink-0 grid place-items-center h-11 w-11 rounded text-emerald-500 hover:bg-emerald-500/15">
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
      <Link href={`/ai/${s.id}`} className="min-w-0 flex-1 text-sm truncate py-3">
        {s.title || "Untitled"}
      </Link>
      {/* Hover actions */}
      {!readOnly && <div className="flex items-center gap-0.5 opacity-100 transition-opacity">
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
      </div>}
    </div>
  );
}
