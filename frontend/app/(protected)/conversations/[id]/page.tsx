'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import usePusher from '@/hooks/usePusher';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageInput } from '@/components/uicustom/chats/message-input';
import { MessageList } from '@/components/uicustom/chats/message-list';
import { PollDisplay } from '@/components/uicustom/chats/poll-display';
import { TypingIndicator } from '@/components/uicustom/chats/primitives/TypingIndicator';
import { ChatSidebar, type SidebarMember } from '@/components/uicustom/chats/ChatSidebar';
import { AnimatePresence } from 'framer-motion';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useConfirm } from '@/components/providers/confirm-dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FiArrowLeft, FiTrash2, FiMoreVertical, FiUsers, FiMessageCircle, FiUser } from 'react-icons/fi';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNowStrict } from 'date-fns';
import Spinner from '@/components/uicustom/spinner';
import { UserHoverCard } from '@/components/uicustom/UserHoverCard';

interface ConversationDetails {
  id: string;
  title: string | null;
  type: 'PUBLIC_THREAD' | 'PRIVATE_DM' | 'GROUP' | 'RESTRICTED';
  deletionRequestedAt: string | null;
  deletionScheduledFor: string | null;
  deletionVisibility: 'PUBLIC' | 'PRIVATE' | null;
  isAnonymized: boolean;
  userId: string;
  originalUserId: string | null;
  participantDetails?: Array<{ id: string; name: string | null; image: string | null }>;
}

const CONVERSATION_TYPE_LABEL: Record<string, string> = {
  GROUP: 'Group chat',
  PUBLIC_THREAD: 'Public thread',
  RESTRICTED: 'Restricted',
  PRIVATE_DM: 'Direct message',
};

export default function ConversationPage() {
  const params = useParams();
  const user = useCurrentUser();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  return <ConversationThread key={`${user?.id ?? 'guest'}:${id ?? ''}`} />;
}

function ConversationThread() {
  const reduceMotion = useReducedMotion();
  const params = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const conversationId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [readProblem, setReadProblem] = useState<'unavailable' | 'error' | null>(null);
  const readRequest = useRef<AbortController | null>(null);
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [isCancellingDeletion, setIsCancellingDeletion] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [managementError, setManagementError] = useState<string | null>(null);
  const managementBusy = useRef(false);
  const [hasPoll, setHasPoll] = useState(false);
  // Right rail (members + voice channel) toggle.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const membersButtonRef = useRef<HTMLButtonElement>(null);

  const currentUser = useCurrentUser();

  const fetchMessages = useCallback(async (showLoading = false) => {
    if (!conversationId) return;
    readRequest.current?.abort();
    const request = new AbortController();
    readRequest.current = request;
    if (showLoading) setLoading(true);
    setReadProblem(null);
    try {
      const response = await fetch(`/api/messages?conversationId=${encodeURIComponent(conversationId)}`, { signal: request.signal });
      if (!response.ok) {
        if (request.signal.aborted) return;
        setReadProblem([401, 403, 404].includes(response.status) ? 'unavailable' : 'error');
        setConversation(null);
        setMessages([]);
        setUsers([]);
        setHasPoll(false);
        return;
      }
      const data = await response.json();
      if (request.signal.aborted) return;
      if (!data.conversation || data.conversation.id !== conversationId || !Array.isArray(data.messages) || !Array.isArray(data.users)) throw new Error('Invalid conversation response');
      
      if (data.messages) {
        setMessages(data.messages);
      }
      if (data.users) {
        setUsers(data.users);
      }
      if (data.conversation) {
        setConversation(data.conversation);
      }
      setHasPoll(Boolean(data.hasPoll || data.poll));
    } catch {
      if (request.signal.aborted) return;
      setReadProblem('error');
      setConversation(null);
      setMessages([]);
      setUsers([]);
      setHasPoll(false);
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void fetchMessages();
    return () => readRequest.current?.abort();
  }, [fetchMessages]);

  // Redirect PUBLIC_THREAD to /pulse/[id] (clean URL with parallel route modal)
  useEffect(() => {
    if (conversation?.type === 'PUBLIC_THREAD' && conversationId) {
      router.replace(`/pulse/${conversationId}`);
    }
  }, [conversation?.type, conversationId, router]);

  // Pusher real-time updates via shared singleton
  const channelName = conversation && !readProblem && conversationId ? `ConversationChannel_${conversationId}` : '';

  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshFromRealtime = useCallback(() => {
    if (realtimeTimer.current) return;
    realtimeTimer.current = setTimeout(() => { realtimeTimer.current = null; void fetchMessages(); }, 150);
  }, [fetchMessages]);
  useEffect(() => () => { if (realtimeTimer.current) clearTimeout(realtimeTimer.current); }, []);
  usePusher(channelName, 'conversation-updated', refreshFromRealtime);
  usePusher(channelName, 'pusher:subscription_succeeded', refreshFromRealtime);
  usePusher(channelName, 'edit-message', refreshFromRealtime);
  usePusher(channelName, 'delete-message', refreshFromRealtime);

  usePusher(channelName, 'new-message', refreshFromRealtime);

  usePusher<{ messageId: string }>(channelName, 'message-deleted', useCallback((data) => {
    setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
  }, []));

  // Typing indicator (additive). Listens for a lightweight `typing` event from
  // other participants; auto-clears after a short idle so it never sticks.
  const [typingName, setTypingName] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); }, []);
  usePusher<{ userId: string; name?: string }>(channelName, 'typing', useCallback((data) => {
    if (data.userId && data.userId === currentUser?.id) return; // ignore self
    setTypingName(data.name || 'Someone');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTypingName(null), 3000);
  }, [currentUser?.id]));

  const handleCancelDeletion = async () => {
    if (!conversationId || managementBusy.current) return;
    managementBusy.current = true;
    setManagementError(null);
    setIsCancellingDeletion(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}?cancel=true`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await fetchMessages();
      } else setManagementError('Could not confirm cancellation. Try again.');
    } catch {
      setManagementError('Could not confirm cancellation. Try again.');
    } finally {
      setIsCancellingDeletion(false);
      managementBusy.current = false;
    }
  };

  // Request deletion of the whole conversation, then return to the list. Mirrors
  // the existing DELETE endpoint (the `?cancel=true` variant undoes it).
  const handleDeleteConversation = async () => {
    if (!conversationId || managementBusy.current) return;
    managementBusy.current = true;
    setManagementError(null);
    try {
      if (!(await confirm({
        title: 'Delete this conversation?',
        description: 'This deletes the shared conversation for everyone. Some conversations have a cancellation period.',
        confirmLabel: 'Delete',
        destructive: true,
      }))) return;
      setIsDeleting(true);
      const res = await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/conversations');
      } else {
        setManagementError('Could not confirm deletion. Try again.');
      }
    } catch {
      setManagementError('Could not confirm deletion. Try again.');
    } finally {
      setIsDeleting(false);
      managementBusy.current = false;
    }
  };

  const canManage = conversation && currentUser && !currentUser.isDemo && !currentUser.isImpersonating && (
    currentUser.id === conversation.userId ||
    currentUser.id === conversation.originalUserId ||
    currentUser.role === 'ADMIN' || currentUser.role === 'OWNER'
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Don't render anything while redirecting public threads
  if (conversation?.type === 'PUBLIC_THREAD') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div role="alert" className="mx-auto flex min-h-[50dvh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">{readProblem === 'error' ? 'Could not load conversation' : 'Conversation unavailable'}</h1>
        <p className="text-sm text-muted-foreground">{readProblem === 'error' ? 'Please try again.' : 'This conversation is missing or you no longer have access.'}</p>
        {readProblem === 'error' && <Button className="min-h-11" onClick={() => void fetchMessages(true)}>Try again</Button>}
        <Button onClick={() => router.push('/conversations')} variant="outline">
          Back to Messages
        </Button>
      </div>
    );
  }

  // Get other participant for DMs
  const otherParticipant = conversation.type === 'PRIVATE_DM' && conversation.participantDetails
    ? conversation.participantDetails.find(p => p.id !== currentUser?.id)
    : null;

  // Members for the sidebar roster — prefer participantDetails, fall back to the
  // users seen in the thread. The conversation owner is labeled.
  const dmMembers: SidebarMember[] = (
    conversation.participantDetails && conversation.participantDetails.length > 0
      ? conversation.participantDetails
      : (users as Array<{ id: string; name: string | null; image: string | null }>)
  ).map((u) => ({
    id: u.id,
    name: u.name ?? 'Member',
    image: u.image ?? null,
    label: u.id === conversation.userId ? 'Owner' : undefined,
  }));

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* Header — OPEN, no second bar. A soft top-down fade (no border, no solid
          fill) so it melts into the thread/landing background instead of reading
          as a chunky toolbar stacked under the global topbar. */}
      <motion.header
        initial={reduceMotion ? undefined : { opacity: 0, y: -10 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        className="relative z-10 shrink-0 bg-linear-to-b from-background via-background/80 to-transparent px-3 py-2.5 [@media(max-height:500px)]:py-0.5"
      >
        {/* Centered inner row — aligns with the message column + composer dock so
            the controls aren't stranded in the far corners on wide screens. */}
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2.5">
        <Link
          href="/conversations"
          aria-label="Back to messages"
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FiArrowLeft className="h-4.5 w-4.5" />
        </Link>

        {conversation.type === 'PRIVATE_DM' && otherParticipant ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <UserHoverCard
              userId={otherParticipant.id}
              userName={otherParticipant.name}
              userImage={otherParticipant.image}
              side="bottom"
              align="start"
            >
              <div className="flex items-center gap-3 min-w-0 cursor-pointer rounded-xl -mx-1 px-1 py-0.5 hover:bg-foreground/[0.05] transition-colors">
                <div className="relative shrink-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={otherParticipant.image || undefined} />
                    <AvatarFallback className="bg-linear-to-br from-brand-accent to-cyan-500 text-white text-sm">
                      {otherParticipant.name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="min-w-0 leading-tight">
                  <h1 className="font-semibold text-[15px] text-foreground truncate">
                    {otherParticipant.name || 'Unknown'}
                  </h1>
                  <p className="text-[11px] text-muted-foreground">Direct message</p>
                </div>
              </div>
            </UserHoverCard>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-accent/15 to-cyan-500/15 text-brand-accent-hover dark:text-brand-accent-light">
              {conversation.type === 'GROUP' ? <FiUsers className="h-4.5 w-4.5" /> : <FiMessageCircle className="h-4.5 w-4.5" />}
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <h1 className="font-semibold text-[15px] text-foreground truncate">
                {conversation.title || 'Untitled conversation'}
              </h1>
              <p className="text-[11px] text-muted-foreground">
                {CONVERSATION_TYPE_LABEL[conversation.type as string] ?? 'Conversation'}
              </p>
            </div>
          </div>
        )}

        <button
          ref={membersButtonRef}
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Members & voice"
          aria-haspopup="dialog"
          aria-expanded={sidebarOpen}
          title="Members & voice"
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            sidebarOpen
              ? 'text-brand-accent bg-brand-accent/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]',
          )}
        >
          <FiUsers className="h-4.5 w-4.5" />
        </button>

        {(canManage || (conversation.type === 'PRIVATE_DM' && otherParticipant)) && <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Conversation options"
              className="rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
            >
              <FiMoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {conversation.type === 'PRIVATE_DM' && otherParticipant && (
              <DropdownMenuItem asChild>
                <Link href={`/profile/${otherParticipant.id}`} className="cursor-pointer">
                  <FiUser className="mr-2 h-4 w-4" /> View profile
                </Link>
              </DropdownMenuItem>
            )}
            {canManage && (
              <>
                {conversation.type === 'PRIVATE_DM' && otherParticipant && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={handleDeleteConversation}
                  disabled={isDeleting || isCancellingDeletion}
                  className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                >
                  <FiTrash2 className="mr-2 h-4 w-4" /> Delete conversation
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>}
        </div>
      </motion.header>

      {managementError && <div role="alert" className="shrink-0 border-b border-border text-sm text-red-700 dark:text-red-400"><p className="mx-auto w-full max-w-3xl px-4 py-3">{managementError}</p></div>}

      {/* Deletion Warning Banner */}
      {conversation.deletionScheduledFor && (
        <div className="shrink-0 border-b border-orange-500/20 bg-orange-500/10">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-sm text-orange-700 dark:text-orange-400">
            <FiTrash2 aria-hidden className="h-4 w-4 shrink-0" />
            <span>
              {new Date(conversation.deletionScheduledFor) <= new Date() ? 'Deletion pending' : `Deletes in ${formatDistanceToNowStrict(new Date(conversation.deletionScheduledFor))}`} · Replies paused
            </span>
          </div>
          {canManage && new Date(conversation.deletionScheduledFor) > new Date() && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelDeletion}
              disabled={isCancellingDeletion || isDeleting}
              className="min-h-11 shrink-0 border-orange-500/30 text-orange-700 hover:bg-orange-500/10 dark:text-orange-400"
            >
              {isCancellingDeletion ? 'Cancelling...' : 'Cancel Deletion'}
            </Button>
          )}
        </div></div>
      )}

      {/* Poll (if exists) */}
      {hasPoll && conversationId && (
        <div className="px-4 py-3 border-b border-border">
          <PollDisplay conversationId={conversationId} />
        </div>
      )}

      {/* Body — thread column + members/voice rail on the LEFT (row-reverse) */}
      <div className="flex-1 flex flex-row-reverse min-h-0">
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Messages — subtle surface so the thread reads as a distinct canvas */}
          <div className="min-h-0 flex-1 overflow-hidden bg-linear-to-b from-muted/30 to-transparent dark:from-background/2">
            <MessageList
              messages={messages}
              users={users}
              conversationId={conversationId!}
              loading={loading}
              onChanged={fetchMessages}
              allowImages={false}
            />
          </div>

          {/* Input — the composer floats over the thread: a soft gradient fade (not a
              hard footer bar) lets messages scroll up behind it, with a centered
              column that aligns with the message list so it never sprawls. */}
          <div className="shrink-0 bg-linear-to-t from-background via-background/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 [@media(max-height:500px)]:px-3 [@media(max-height:500px)]:pb-[max(0.25rem,env(safe-area-inset-bottom))] [@media(max-height:500px)]:pt-1">
            <div className="mx-auto w-full max-w-3xl">
              <AnimatePresence>
                {typingName && (
                  <div className="mb-2 px-1">
                    <TypingIndicator label={`${typingName} is typing…`} />
                  </div>
                )}
              </AnimatePresence>
              <fieldset disabled={!!conversation.deletionScheduledFor} aria-label="Message composer" className="m-0 min-w-0 border-0 p-0 disabled:opacity-60">
              <MessageInput
                conversationId={conversationId!}
                onMessageSent={fetchMessages}
                allowImages={false}
              />
              </fieldset>
            </div>
          </div>
        </div>

        {/* Reuse the AI conversation sheet; never squeeze the transcript. */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="right" accessibleTitle="Members & voice" accessibleDescription="Conversation members and experimental voice tools."
            onCloseAutoFocus={event => { event.preventDefault(); membersButtonRef.current?.focus(); }}
            className="flex w-[min(22rem,calc(100%-2rem))] max-w-full flex-col border-border bg-background p-0 pt-14 pb-[env(safe-area-inset-bottom)]">
              <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-16">
                <ChatSidebar
                  roomId={conversationId!}
                  self={{ id: currentUser?.id ?? 'me', name: currentUser?.name ?? 'You', image: currentUser?.image ?? null }}
                  isHost={!!canManage}
                  membersTitle={conversation.type === 'GROUP' ? 'Members' : 'People'}
                  members={dmMembers}
                />
              </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
