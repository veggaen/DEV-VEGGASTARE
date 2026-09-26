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
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiCheck, FiX, FiMenu, FiMessageSquare, FiRefreshCw } from "react-icons/fi";
import { GripVertical, MoreHorizontal, ArrowUp, ArrowDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { moveRail, orderRail, readRailOrder } from '@/lib/ai-chat/rail-order';
import { cn } from "@/lib/utils";
import { useUiPreferences } from "@/components/providers/ui-preferences";
import { useConfirm } from "@/components/providers/confirm-dialog";
import { useAiSessionList } from '@/hooks/use-ai-session-list';
import { SessionId, type ShellSession } from '@/lib/ai-chat/session-list';

const RAIL_W = "18rem";

export function AiChatShell({
  isLoggedIn,
  userId = null,
  isDemo = false,
  children,
}: {
  isLoggedIn: boolean;
  userId?: string | null;
  isDemo?: boolean;
  children: React.ReactNode;
}) {
  const { prefs } = useUiPreferences();
  const overlay = prefs.aiChatLayout === "overlay";
  const pathname = usePathname();
  const studio = pathname === '/ai/studio';
  const router = useRouter();
  const confirm = useConfirm();

  const [query, setQuery] = React.useState("");
  const [order, setOrder] = React.useState<string[]>([]);
  const [orderNotice, setOrderNotice] = React.useState('');
  const orderKey = userId ? `veggat:ai-order:${userId}` : null;
  React.useEffect(() => {
    try { setOrder(orderKey ? readRailOrder(localStorage.getItem(orderKey)) : []); } catch { setOrder([]); }
  }, [orderKey]);
  const list = useAiSessionList(isLoggedIn && !studio, query);
  const { refresh, update } = list;
  const sessions = React.useMemo(() => list.sessions ? orderRail(list.sessions, order) : null, [list.sessions, order]);
  const reorder = (source: string, target: string) => {
    if (query.trim() || !sessions) return;
    const ids = [...sessions.map(row => row.id), ...order.filter(id => !sessions.some(row => row.id === id))];
    const next = moveRail(ids, source, target);
    setOrder(next);
    setOrderNotice('Conversation order updated.');
    try { if (orderKey) localStorage.setItem(orderKey, JSON.stringify(next)); } catch { setOrderNotice('Reordered for this visit. Browser storage is unavailable.'); }
  };
  const [creating, setCreating] = React.useState(false);
  // Drawer open state (used in overlay mode + on mobile).
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const lastDrawerOpener = React.useRef<HTMLElement | null>(null);

  // The id in the URL (/ai/<id>) — drives the active highlight.
  const activeId = React.useMemo(() => {
    const m = pathname.match(/^\/ai\/([^/]+)/);
    return m?.[1] ?? null;
  }, [pathname]);

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
        signal: AbortSignal.timeout(15_000),
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (!SessionId.safeParse(data.id).success) throw new Error('Invalid conversation response');
        refresh();
        router.push(`/ai/${data.id}`);
      } else { const data = await res.json().catch(() => ({})); toast.error(data.message ?? "Could not create a conversation. Please retry."); }
    } catch { toast.error("Connection failed. Please retry."); } finally { setCreating(false); }
  }, [isLoggedIn, router, refresh]);

  const rename = React.useCallback(async (id: string, title: string) => {
    try {
      const response = await fetch(`/api/ai-chat/sessions/${id}`, {
        signal: AbortSignal.timeout(15_000),
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) { toast.error("This conversation could not be renamed. Your draft is still here."); return false; }
      update(id, title); return true;
    } catch { toast.error("Could not save the name. Your draft is still here."); return false; }
  }, [update]);

  const remove = React.useCallback(async (id: string) => {
    if (!(await confirm({ title: "Delete this conversation?", confirmLabel: "Delete", destructive: true }))) return;
    try {
      const response = await fetch(`/api/ai-chat/sessions/${id}`, { method: "DELETE", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) { toast.error("This conversation could not be deleted. Please retry."); return; }
    } catch { toast.error("Could not delete the conversation. Please retry."); return; }
    update(id);
    if (activeId === id) router.push("/ai");
  }, [activeId, router, update, confirm]);

  const rail = (
    <AiChatRail
      sessions={sessions}
      activeId={activeId}
      creating={creating}
      query={query}
      onQuery={setQuery}
      onNewChat={newChat}
      onRename={rename}
      onRemove={remove}
      readOnly={isDemo}
      isLoggedIn={isLoggedIn}
      loading={list.loading}
      error={list.error}
      hasMore={list.hasMore}
      capped={list.capped}
      onRetry={refresh}
      onMore={list.loadMore}
      onReorder={reorder}
      orderNotice={orderNotice}
    />
  );

  // Persistent (desktop): rail docked. Overlay or mobile: rail is a drawer.
  const docked = !overlay;

  if (studio) return <div className="mx-auto h-[calc(100dvh-var(--app-header-offset,64px)-var(--demo-notice-height,0px))] w-full max-w-[1280px] min-w-0">{children}</div>;

  return (
    <div className="relative flex h-full flex-1 w-full min-h-0 min-w-0 overflow-hidden">
      {docked && <aside className="hidden shrink-0 flex-col border-r border-border bg-background/60 lg:flex" style={{ width: RAIL_W }}>{rail}</aside>}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <div className={pathname === '/ai/credits' ? cn('px-4 pt-2', docked && 'lg:hidden') : 'hidden'}>
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
  sessions, activeId, creating, query, onQuery, onNewChat, onRename, onRemove, readOnly, isLoggedIn, loading, error, hasMore, capped, onRetry, onMore, onReorder, orderNotice,
}: {
  sessions: ShellSession[] | null;
  activeId: string | null;
  creating: boolean;
  query: string;
  onQuery: (v: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  readOnly: boolean;
  isLoggedIn: boolean;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  capped: boolean;
  onRetry: () => void;
  onMore: () => void;
  onReorder: (source: string, target: string) => void;
  orderNotice: string;
}) {
  const dragId = React.useRef<string | null>(null);
  return (
    <nav aria-label="AI conversations" className="flex flex-col h-full min-h-0">
      <Link href="/ai/studio" className="mx-3 mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline">Images & video</Link>
      {/* Header: New chat */}
      <div className="flex gap-2 p-3 pb-2">
        <button
          onClick={onNewChat}
          disabled={creating}
          className="group w-full min-h-11 flex items-center justify-center gap-2 rounded-xl bg-muted text-foreground text-sm font-medium px-4 py-2.5 hover:bg-muted/70 disabled:opacity-50 transition-colors"
        >
          {creating
            ? <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-black/40 border-t-transparent motion-safe:animate-spin" />
            : <FiPlus aria-hidden="true" className="h-4 w-4" />}
          {creating ? 'Creating…' : 'New chat'}
        </button>
        {isLoggedIn && <button type="button" onClick={onRetry} disabled={loading} aria-label="Refresh conversations" className="grid size-11 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted focus-visible:outline disabled:opacity-50"><FiRefreshCw aria-hidden="true" className={loading ? 'motion-safe:animate-spin' : ''} /></button>}
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
            name="conversation-search" type="search" autoComplete="off" maxLength={200} disabled={!isLoggedIn}
            className="w-full rounded-lg bg-muted/40 border border-border h-11 pl-9 pr-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div aria-busy={loading} className="flex-1 overflow-y-auto overscroll-contain-y px-2 pb-3 min-h-0" data-ai-conversation-scroll>
        {error && <div role="alert" className="m-1 rounded-lg border border-destructive/40 p-3 text-xs leading-5"><p>{error}</p>{sessions && <p className="mt-1 text-muted-foreground">Previously loaded chats remain below and may be out of date.</p>}<button type="button" disabled={loading} onClick={onRetry} className="mt-2 min-h-11 rounded-lg border border-border px-3 font-medium hover:bg-muted focus-visible:outline">Retry conversations</button></div>}
        {!isLoggedIn ? <p className="px-3 py-8 text-center text-sm text-muted-foreground"><Link href="/auth/login?callbackUrl=%2Fai" className="underline underline-offset-4">Sign in to see your conversations.</Link></p>
        : sessions === null ? loading && <div role="status" aria-label="Loading conversations" className="space-y-2 p-2"><span className="sr-only">Loading conversations…</span>{Array.from({length:6}, (_,i) => <div key={i} aria-hidden="true" className="h-14 rounded-lg bg-muted motion-safe:animate-pulse" />)}</div>
        : sessions.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            {query.trim() ? "No chats match your search." : "No conversations yet."}
          </p>
        ) : (
          <div className="space-y-0.5">
            {sessions.map((s, index) => (
              <RailRow
                key={s.id}
                session={s}
                active={s.id === activeId}
                onRename={onRename}
                onRemove={onRemove}
                readOnly={readOnly}
                onMove={!query.trim() ? direction => { const target = sessions[index + direction]; if (target) onReorder(s.id, target.id); } : undefined}
                canMoveUp={index > 0}
                canMoveDown={index < sessions.length - 1}
                onDragStart={!query.trim() ? () => { dragId.current = s.id; } : undefined}
                onDrop={() => { if (dragId.current) onReorder(dragId.current, s.id); dragId.current = null; }}
                onDragEnd={() => { dragId.current = null; }}
              />
            ))}
          </div>
        )}
      </div>
      {hasMore && <div className="px-3 pb-2">{capped ? <p className="text-xs text-muted-foreground">Showing the first 250 matches. Refine your search to find older chats.</p> : <button type="button" onClick={onMore} disabled={loading} className="min-h-11 w-full rounded-lg border border-border px-3 text-sm hover:bg-muted focus-visible:outline">{loading ? 'Loading…' : 'Load more conversations'}</button>}</div>}
      <span className="sr-only" role="status">{orderNotice}</span>
      <div aria-live="polite" className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        {loading ? 'Loading conversations…' : sessions ? `${sessions.length} conversation${sessions.length === 1 ? '' : 's'}${hasMore ? ' loaded' : ''}${query.trim() ? ' matching your search' : ''}` : isLoggedIn ? 'Conversations unavailable' : 'Private conversation history'}
      </div>
    </nav>
  );
}

/** One conversation row with inline rename + delete. */
export function RailRow({
  session: s, active, onRename, onRemove, readOnly, onMove, canMoveUp, canMoveDown, onDragStart, onDrop, onDragEnd,
}: {
  session: ShellSession;
  active: boolean;
  onRename: (id: string, title: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  readOnly: boolean;
  onMove?: (direction: -1 | 1) => void;
  canMoveUp?: boolean; canMoveDown?: boolean;
  onDragStart?: () => void; onDrop?: () => void; onDragEnd?: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(s.title);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const commit = async () => {
    if (saving) return;
    const t = draft.trim();
    if (!t) return;
    if (t === s.title) { setEditing(false); return; }
    setSaving(true);
    try { if (await onRename(s.id, t)) setEditing(false); } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-black/5 dark:bg-white/8">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void commit(); } if (e.key === "Escape" && !saving) { setDraft(s.title); setEditing(false); } }}
          aria-label="Conversation title" name="conversation-title" autoComplete="off" maxLength={200} disabled={saving}
          className="flex-1 min-w-0 h-11 rounded bg-transparent text-base focus-visible:outline focus-visible:outline-2"
        />
        <button onClick={() => void commit()} disabled={saving || !draft.trim()} aria-label="Save conversation name" className="shrink-0 grid place-items-center h-11 w-11 rounded text-emerald-500 hover:bg-emerald-500/15 focus-visible:outline disabled:opacity-50">
          <FiCheck className="h-3.5 w-3.5" />
        </button>
        <button disabled={saving} onClick={() => { setDraft(s.title); setEditing(false); }} aria-label="Cancel renaming" className="shrink-0 grid place-items-center h-11 w-11 rounded text-muted-foreground hover:bg-muted focus-visible:outline">
          <FiX className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={event => { if (onMove) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
      onDrop={event => { event.preventDefault(); onDrop?.(); }}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 60px' }}
      className={cn(
        "group/row relative flex items-center gap-2 rounded-lg pl-2.5 pr-1 py-1.5 transition-colors",
        active ? "bg-emerald-500/12 text-foreground" : "hover:bg-black/5 dark:hover:bg-white/8",
      )}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-emerald-500" />}
      {onDragStart ? <button type="button" draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', s.id); onDragStart(); }}
        onDragEnd={onDragEnd} aria-label={`Reorder ${s.title || 'Untitled'}`} title="Drag to reorder, or use the conversation menu"
        onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); onMove?.(event.key === 'ArrowUp' ? -1 : 1); } }}
        className="grid size-11 shrink-0 cursor-grab place-items-center rounded-lg text-muted-foreground/60 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"><GripVertical size={15} aria-hidden="true" /></button>
        : <FiMessageSquare className={cn("h-3.5 w-3.5 shrink-0", active ? "text-emerald-500" : "text-muted-foreground/60")} />}
      <Link href={`/ai/${s.id}`} aria-current={active ? 'page' : undefined} title={s.title || 'Untitled'} className="min-w-0 flex-1 text-sm truncate py-3 focus-visible:outline">
        {s.title || "Untitled"}
      </Link>
      {(!readOnly || onMove) && <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" aria-label={`Options for ${s.title || 'Untitled'}`} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><MoreHorizontal size={17} aria-hidden="true" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onMove && <><DropdownMenuItem disabled={!canMoveUp} onSelect={() => onMove(-1)}><ArrowUp size={15} aria-hidden="true" /> Move up</DropdownMenuItem>
            <DropdownMenuItem disabled={!canMoveDown} onSelect={() => onMove(1)}><ArrowDown size={15} aria-hidden="true" /> Move down</DropdownMenuItem></>}
          {!readOnly && <><DropdownMenuItem aria-label={`Rename ${s.title || 'Untitled'}`} onSelect={() => { setDraft(s.title); setEditing(true); }}><FiEdit2 aria-hidden="true" /> Rename</DropdownMenuItem>
            <DropdownMenuItem aria-label={`Delete ${s.title || 'Untitled'}`} onSelect={() => onRemove(s.id)} className="text-destructive"><FiTrash2 aria-hidden="true" /> Delete</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>}
    </div>
  );
}
