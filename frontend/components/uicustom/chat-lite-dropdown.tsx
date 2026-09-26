'use client';

/** @fileOverview Account-scoped, on-demand inbox preview with accessible recovery. @stability active */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/use-current-user';
import { cn } from '@/lib/utils';
import { InboxPreviewSchema, previewName, type InboxPreview } from '@/lib/messages-preview';
import { FiArrowRight, FiEdit, FiMessageSquare, FiSearch, FiX } from 'react-icons/fi';

export function ChatLiteDropdown({ className }: { className?: string }) {
  const user = useCurrentUser();
  const pathname = usePathname();
  if (!user?.id) return null;
  // Remount on identity/navigation changes: no previous account's rows or drafts.
  return <MessagePopover key={`${user.id}:${pathname}`} userId={user.id} className={className} />;
}

function MessagePopover({ userId, className }: { userId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" aria-label="Messages" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring', className)}>
        <FiMessageSquare aria-hidden className="h-[18px] w-[18px]" />
      </button>
    </PopoverTrigger>
    <PopoverContent ref={panelRef} align="end" sideOffset={8} collisionPadding={16} aria-label="Recent messages"
      onKeyDownCapture={event => {
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
          event.preventDefault(); event.stopPropagation(); setOpen(false);
        }
      }}
      onOpenAutoFocus={event => {
        event.preventDefault();
        // Don't open the phone keyboard merely by opening Messages.
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) searchRef.current?.focus();
        else panelRef.current?.focus();
      }}
      className="flex max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[min(24rem,var(--radix-popover-content-available-width))] min-w-0 flex-col overflow-hidden rounded-2xl border-border p-0 motion-reduce:animate-none">
      {open && <MessagePreview userId={userId} searchRef={searchRef} onNavigate={() => setOpen(false)} />}
    </PopoverContent>
  </Popover>;
}

type PreviewState = { status: 'loading' } | { status: 'error' | 'unauthorized' } | { status: 'ready'; data: InboxPreview };
function MessagePreview({ userId, searchRef, onNavigate }: { userId: string; searchRef: React.RefObject<HTMLInputElement | null>; onNavigate: () => void }) {
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    async function load() {
      try {
        const response = await fetch('/api/conversations?filter=private&sort=active&limit=8', { cache: 'no-store', signal: controller.signal });
        if (!active) return;
        if (response.status === 401 || response.status === 403) { setState({ status: 'unauthorized' }); return; }
        if (!response.ok) throw new Error('Inbox unavailable');
        const data = InboxPreviewSchema.parse(await response.json());
        if (active) setState({ status: 'ready', data });
      } catch { if (active) setState({ status: 'error' }); }
      finally { window.clearTimeout(timeout); }
    }
    void load();
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  const query = search.trim().toLocaleLowerCase();
  const filtered = state.status === 'ready' ? state.data.conversations.filter(item =>
    !query || [previewName(item, userId), item.lastMessage?.content, ...item.participantDetails.map(person => person.name)].some(value => value?.toLocaleLowerCase().includes(query))) : [];
  const clearSearch = () => { setSearch(''); searchRef.current?.focus(); };
  return <>
    <div className="shrink-0 border-b border-border px-4 pb-3 pt-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Messages</h2>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" className="min-h-11 gap-2 px-2"><Link href="/conversations/new" onClick={onNavigate}><FiEdit aria-hidden />New chat</Link></Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Close messages" className="h-11 w-11" onClick={onNavigate}><FiX aria-hidden /></Button>
        </div>
      </div>
      <div className="relative">
        <FiSearch aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input ref={searchRef} name="recent-message-search" type="search" autoComplete="off" aria-label="Search recent conversations" placeholder="Search recent chats…" value={search} onChange={event => setSearch(event.target.value)} className="h-11 w-full min-w-0 rounded-xl border border-border bg-background pl-9 pr-11 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:appearance-none" />
        {search && <button type="button" aria-label="Clear search" onClick={clearSearch} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><FiX aria-hidden /></button>}
      </div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <div role="status" className="px-4">
        <span className="sr-only">Loading conversations…</span>
        {Array.from({ length: 3 }, (_, i) => <div key={i} aria-hidden className="flex h-[88px] items-center gap-3"><Skeleton className="h-11 w-11 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-16" /></div></div>)}
      </div> : state.status === 'unauthorized' ? <div role="alert" className="space-y-3 p-5 text-center">
        <p className="text-sm">Sign in again to see your messages.</p><Button asChild className="min-h-11"><Link href="/auth/login" onClick={onNavigate}>Sign in</Link></Button>
      </div> : state.status === 'error' ? <div role="alert" className="space-y-3 p-5 text-center">
        <p className="text-sm">Could not load messages.</p><Button variant="outline" className="min-h-11" onClick={() => { setState({ status: 'loading' }); setAttempt(value => value + 1); }}>Try again</Button>
      </div> : filtered.length === 0 ? <div role="status" className="space-y-3 p-6 text-center text-sm text-muted-foreground">
        <p>{query ? 'No matching recent chats' : 'No conversations yet'}</p>
        {query && <Button variant="outline" className="min-h-11" onClick={clearSearch}>Clear search</Button>}
      </div> : <ul aria-label="Recent conversations" className="divide-y divide-border/60">
        {filtered.map(item => {
          const name = previewName(item, userId);
          const other = item.type === 'PRIVATE_DM' ? item.participantDetails.find(person => person.id !== userId) : null;
          const updated = item.lastMessage?.createdAt || item.lastActivityAt || item.updatedAt;
          const date = new Date(updated);
          return <li key={item.id}>
            <Link href={`/conversations/${encodeURIComponent(item.id)}`} prefetch={false} onClick={onNavigate} className="flex min-w-0 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <Avatar className="h-11 w-11 shrink-0"><AvatarImage src={other?.image ?? undefined} alt="" /><AvatarFallback>{name[0]?.toUpperCase() || '?'}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-sm text-muted-foreground">{item.lastMessage?.senderId === userId && 'You: '}{item.lastMessage?.content || (item.lastMessage?.imageUrl ? 'Photo' : 'No messages yet')}</p>
                {!Number.isNaN(date.valueOf()) && <time dateTime={updated} className="mt-1 block text-xs text-muted-foreground">{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>}
              </div>
            </Link>
          </li>;
        })}
      </ul>}
    </div>
    <div className="shrink-0 border-t border-border p-2">
      <Button asChild variant="ghost" className="min-h-11 w-full gap-2"><Link href="/conversations" onClick={onNavigate}>Open full inbox<FiArrowRight aria-hidden /></Link></Button>
    </div>
  </>;
}
