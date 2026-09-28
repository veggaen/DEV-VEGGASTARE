'use client';

/** @fileOverview Private inbox with accessible row actions and paged recovery. @stability active */
import { useRef, useState } from 'react';
import useSWRInfinite from 'swr/infinite';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConversationListSkeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useConfirm } from '@/components/providers/confirm-dialog';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { FiPlus, FiMessageCircle, FiUsers, FiLock, FiTrash2, FiMoreVertical, FiShare2, FiEye, FiSearch, FiInbox } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { PageHeader } from '@/components/uicustom/chrome/page-header';
import { HoverChaser } from '@/components/uicustom/chrome/hover-chaser';
import { StatusPill, fieldClass } from '@/components/uicustom/settings/settings-primitives';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string | null;
  description?: string | null;
  participantDetails: { id: string; name: string | null; image?: string | null }[];
  type: 'PUBLIC_THREAD' | 'PRIVATE_DM' | 'GROUP' | 'RESTRICTED';
  isPinned: boolean;
  isLocked: boolean;
  lastMessage: { content: string; createdAt: string; imageUrl?: string | null } | null;
  messageCount: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  deletionScheduledFor?: string | null;
  originalUserId?: string | null;
}
interface InboxPage { conversations: Conversation[]; nextCursor: string | null }
type Sort = 'recent' | 'active';
class InboxReadError extends Error {
  constructor(public status: number) { super('Could not load messages. Try again.'); }
}

export default function ConversationsPage() {
  const { user, status } = useCurrentUserWithStatus();
  if (!user?.id) return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      {status === 'loading' ? <ConversationListSkeleton count={6} /> : (
        <div className="py-12 text-center"><p className="mb-4">Sign in to see your messages.</p><Button asChild><Link href="/auth/login">Sign in</Link></Button></div>
      )}
    </div>
  );
  return <Inbox key={user.id} userId={user.id} role={user.role} readOnly={!!(user.isDemo || user.isImpersonating)} />;
}

function Inbox({ userId, role, readOnly }: { userId: string; role?: string; readOnly: boolean }) {
  const confirm = useConfirm();
  const [sort, setSort] = useState<Sort>('active');
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const busy = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<InboxPage, InboxReadError>(
    (index, previous: InboxPage | null) => previous && !previous.nextCursor ? null : ['private-inbox', userId, sort, index, previous?.nextCursor ?? ''],
    async ([, , selectedSort, , cursor]: [string, string, Sort, number, string]) => {
      const query = new URLSearchParams({ filter: 'private', sort: selectedSort, limit: '50' });
      if (cursor) query.set('cursor', cursor);
      const response = await fetch(`/api/conversations?${query}`, { cache: 'no-store' });
      if (!response.ok) throw new InboxReadError(response.status);
      const payload = await response.json();
      const items = Array.isArray(payload) ? payload : payload.conversations;
      if (!Array.isArray(items)) throw new InboxReadError(502);
      return { conversations: items, nextCursor: typeof payload.nextCursor === 'string' ? payload.nextCursor : null };
    },
    { dedupingInterval: 15_000, keepPreviousData: false, persistSize: false, shouldRetryOnError: false }
  );
  const accessLost = error?.status === 401 || error?.status === 403;
  const conversations = accessLost ? [] : [...new Map((data ?? []).flatMap(page => page.conversations).map(item => [item.id, item])).values()];
  const query = search.trim().toLocaleLowerCase();
  const filtered = conversations.filter(item => !query || [item.title, item.description, ...(item.participantDetails ?? []).map(person => person.name)].some(value => value?.toLocaleLowerCase().includes(query)));
  const hasMore = !accessLost && !!data?.at(-1)?.nextCursor;
  const canManage = (item: Conversation) => !readOnly && (item.userId === userId || item.originalUserId === userId || role === 'ADMIN' || role === 'OWNER');

  async function copyLink(id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/conversations/${id}`);
      toast.success('Link copied');
    } catch { toast.error('Could not copy the link. Open the conversation and copy its address.'); }
  }

  async function deleteConversation(item: Conversation, cancel = false) {
    if (busy.current) return;
    busy.current = true;
    try {
      if (!cancel && !(await confirm({ title: 'Delete this conversation?', description: 'This deletes the shared conversation for everyone. Some conversations have a cancellation period.', confirmLabel: 'Delete', destructive: true }))) return;
      setPendingId(item.id);
      const response = await fetch(`/api/conversations/${item.id}?${cancel ? 'cancel=true' : 'visibility=PRIVATE'}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(cancel ? 'Could not cancel deletion. Try again.' : 'Could not delete the conversation. Try again.');
        if (response.status === 401 || response.status === 403) await mutate();
        return;
      }
      toast.success(cancel ? 'Deletion cancelled' : result.scheduled ? 'Deletion scheduled' : 'Conversation deleted');
      await mutate();
    } catch { toast.error('Could not update the conversation. Try again.'); }
    finally { busy.current = false; setPendingId(null); }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        eyebrow="Inbox"
        title="Messages"
        description="Private conversations with sellers, buyers and support."
        actions={<Button asChild variant="vegaEmeraldBtn" className="min-h-11 gap-2"><Link href="/conversations/new"><FiPlus aria-hidden />New chat</Link></Button>}
        className="mb-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <FiSearch aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input ref={searchInput} type="search" name="conversation-search" autoComplete="off" aria-label="Search conversations" placeholder="Search conversations…" value={search} onChange={event => setSearch(event.target.value)} className={cn(fieldClass, 'h-12 w-full border pl-10 pr-3 outline-none')} />
          </div>
          <Select value={sort} onValueChange={value => setSort(value as Sort)}>
            <SelectTrigger aria-label="Sort conversations" className={cn(fieldClass, 'h-12 w-full sm:w-52')}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="active">Latest activity</SelectItem><SelectItem value="recent">Newest conversations</SelectItem></SelectContent>
          </Select>
        </div>
      </PageHeader>
      {isLoading ? <ConversationListSkeleton count={6} /> : accessLost ? (
        <div role="alert" className="rounded-2xl border border-border/60 p-6 text-center"><p className="mb-4">Sign in again to view your messages.</p><Button asChild><Link href="/auth/login">Sign in</Link></Button></div>
      ) : (
        <>
          {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"><p>Could not load messages.</p><Button variant="vegaNormalBtn" className="min-h-11" disabled={isValidating} onClick={() => void mutate()}>Try again</Button></div>}
          {!error && filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
              <FiInbox aria-hidden className="mx-auto mb-3 size-8 text-muted-foreground" />
              <h2 className="mb-4 font-medium">{query ? 'No matching conversations' : 'No conversations yet'}</h2>
              {query ? <Button variant="vegaNormalBtn" className="min-h-11" onClick={() => { setSearch(''); searchInput.current?.focus(); }}>Clear search</Button> : <Button asChild variant="vegaEmeraldBtn" className="min-h-11"><Link href="/conversations/new">Start a conversation</Link></Button>}
            </div>
          )}
          <HoverChaser as="ul" aria-label="Conversations" className="space-y-1" boxClassName="rounded-2xl">
            {filtered.map(item => {
              const people = item.participantDetails ?? [];
              const other = item.type === 'PRIVATE_DM' ? people.find(person => person.id !== userId) : null;
              const title = other?.name || item.title || 'Untitled conversation';
              const updated = item.lastMessage?.createdAt || item.updatedAt;
              const date = new Date(updated);
              return (
                <li key={item.id} data-chase className="flex min-w-0 items-center gap-1 rounded-2xl pr-1 [content-visibility:auto] [contain-intrinsic-size:auto_92px]">
                  <Link href={`/conversations/${item.id}`} prefetch={false} className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl px-3 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4">
                    <Avatar className="size-11 shrink-0 ring-1 ring-border/60">{other?.image && <AvatarImage src={other.image} alt="" />}<AvatarFallback className="bg-brand-accent/10 text-brand-accent">{other ? other.name?.[0] || '?' : item.type === 'GROUP' ? <FiUsers aria-hidden /> : <FiMessageCircle aria-hidden />}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-sm font-semibold">{title}</h2>
                        {item.isLocked && <FiLock aria-label="Locked" className="size-3.5 shrink-0 text-muted-foreground" />}
                        {item.isPinned && <StatusPill>Pinned</StatusPill>}
                        {!Number.isNaN(date.valueOf()) && <time dateTime={updated} className="ml-auto shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(date, { addSuffix: true })}</time>}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{item.lastMessage?.content || (item.lastMessage?.imageUrl ? 'Photo' : 'No messages yet')}</p>
                      {(item.type === 'GROUP' || item.deletionScheduledFor) && <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{item.type === 'GROUP' && <span>{people.length} members</span>}{item.deletionScheduledFor && <span className="text-destructive">Deletion scheduled</span>}</div>}
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${title}`} disabled={pendingId !== null} className="size-11 shrink-0 rounded-xl"><FiMoreVertical aria-hidden className="size-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-[120] max-w-xs rounded-xl border-border/70 bg-popover/95 p-1 shadow-e3 backdrop-blur-xl">
                      <DropdownMenuItem asChild className="min-h-11 rounded-lg"><Link href={`/conversations/${item.id}`}><FiEye aria-hidden className="mr-2" />Open conversation</Link></DropdownMenuItem>
                      <DropdownMenuItem className="min-h-11 rounded-lg" onSelect={() => void copyLink(item.id)}><FiShare2 aria-hidden className="mr-2" />Copy link</DropdownMenuItem>
                      {canManage(item) && <><DropdownMenuSeparator /><DropdownMenuItem className="min-h-11 rounded-lg text-destructive focus:text-destructive" onSelect={() => void deleteConversation(item, !!item.deletionScheduledFor)}><FiTrash2 aria-hidden className="mr-2" />{item.deletionScheduledFor ? 'Cancel deletion' : 'Delete'}</DropdownMenuItem></>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </HoverChaser>
          {hasMore && <div className="mt-4 space-y-2 text-center">{query && <p className="text-sm text-muted-foreground">Searching loaded conversations.</p>}<Button variant="vegaNormalBtn" className="min-h-11" disabled={isValidating} onClick={() => void (error ? mutate() : setSize(size + 1))}>{isValidating ? 'Loading…' : error ? 'Retry loading more' : 'Load more conversations'}</Button></div>}
        </>
      )}
    </div>
  );
}
