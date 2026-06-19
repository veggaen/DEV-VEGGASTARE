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
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FiArrowLeft, FiTrash2, FiMoreVertical, FiUsers, FiMessageCircle, FiUser, FiBellOff } from 'react-icons/fi';
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
  const reduceMotion = useReducedMotion();
  const params = useParams();
  const router = useRouter();
  const conversationId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [isCancellingDeletion, setIsCancellingDeletion] = useState(false);
  const [hasPoll, setHasPoll] = useState(false);
  // Local mute preference (UI-level notification toggle for this thread).
  const [muted, setMuted] = useState(false);
  // Right rail (members + voice channel) toggle.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentUser = useCurrentUser();

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      const response = await fetch(`/api/messages?conversationId=${conversationId}`);
      const data = await response.json();
      
      if (data.messages) {
        setMessages(data.messages);
      }
      if (data.users) {
        setUsers(data.users);
      }
      if (data.conversation) {
        setConversation(data.conversation);
      }
      if (data.hasPoll || data.poll) {
        setHasPoll(true);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Redirect PUBLIC_THREAD to /pulse/[id] (clean URL with parallel route modal)
  useEffect(() => {
    if (conversation?.type === 'PUBLIC_THREAD' && conversationId) {
      router.replace(`/pulse/${conversationId}`);
    }
  }, [conversation?.type, conversationId, router]);

  // Pusher real-time updates via shared singleton
  const channelName = conversationId ? `ConversationChannel_${conversationId}` : '';

  usePusher<{ message?: any; conversationId?: string }>(channelName, 'new-message', useCallback((data: any) => {
    const newMessage = data.message || data;
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMessage.id)) return prev;
      return [...prev, newMessage];
    });
  }, []));

  usePusher<{ messageId: string }>(channelName, 'message-deleted', useCallback((data) => {
    setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
  }, []));

  // Typing indicator (additive). Listens for a lightweight `typing` event from
  // other participants; auto-clears after a short idle so it never sticks.
  const [typingName, setTypingName] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  usePusher<{ userId: string; name?: string }>(channelName, 'typing', useCallback((data) => {
    if (data.userId && data.userId === currentUser?.id) return; // ignore self
    setTypingName(data.name || 'Someone');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTypingName(null), 3000);
  }, [currentUser?.id]));

  const handleCancelDeletion = async () => {
    if (!conversationId) return;
    setIsCancellingDeletion(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}?cancel=true`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchMessages();
      }
    } catch (error) {
      console.error('Error cancelling deletion:', error);
    } finally {
      setIsCancellingDeletion(false);
    }
  };

  // Request deletion of the whole conversation, then return to the list. Mirrors
  // the existing DELETE endpoint (the `?cancel=true` variant undoes it).
  const handleDeleteConversation = async () => {
    if (!conversationId) return;
    if (!confirm('Delete this conversation? This will start the deletion process.')) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/conversations');
      } else {
        const { toast } = await import('sonner');
        toast.error('Could not delete the conversation.');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      const { toast } = await import('sonner');
      toast.error('Could not delete the conversation.');
    }
  };

  const canManage = conversation && currentUser && (
    currentUser.id === conversation.userId ||
    currentUser.id === conversation.originalUserId ||
    (currentUser as any).role === 'ADMIN'
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
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Conversation not found</h2>
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
    <div className="relative flex flex-col h-[calc(100vh-var(--app-header-offset,64px))]">
      {/* Header — OPEN, no second bar. A soft top-down fade (no border, no solid
          fill) so it melts into the thread/landing background instead of reading
          as a chunky toolbar stacked under the global topbar. */}
      <motion.header
        initial={reduceMotion ? undefined : { opacity: 0, y: -10 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        className="relative z-10 bg-linear-to-b from-background via-background/80 to-transparent px-3 py-2.5"
      >
        {/* Centered inner row — aligns with the message column + composer dock so
            the controls aren't stranded in the far corners on wide screens. */}
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2.5">
        <Link
          href="/conversations"
          aria-label="Back to messages"
          className="grid place-items-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
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
              <div className="flex items-center gap-3 min-w-0 cursor-pointer rounded-xl -mx-1 px-1 py-0.5 hover:bg-black/3 dark:hover:bg-white/5 transition-colors">
                <div className="relative shrink-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={otherParticipant.image || undefined} />
                    <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-600 text-white text-sm">
                      {otherParticipant.name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  {/* presence dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                </div>
                <div className="min-w-0 leading-tight">
                  <h1 className="font-semibold text-[15px] text-foreground truncate">
                    {otherParticipant.name || 'Unknown'}
                  </h1>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400/80">Active now</p>
                </div>
              </div>
            </UserHoverCard>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-indigo-500/15 to-purple-600/15 text-indigo-500 dark:text-indigo-300">
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

        {muted && (
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-black/5 dark:bg-white/8 px-2 py-1 text-[10px] text-muted-foreground">
            <FiBellOff className="h-3 w-3" /> Muted
          </span>
        )}

        <button
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Members & voice"
          title="Members & voice"
          className={cn(
            'grid place-items-center h-9 w-9 rounded-full transition-colors',
            sidebarOpen
              ? 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10',
          )}
        >
          <FiUsers className="h-4.5 w-4.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Conversation options"
              className="rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10"
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
            <DropdownMenuItem onClick={() => setMuted((m) => !m)} className="cursor-pointer">
              <FiBellOff className="mr-2 h-4 w-4" />
              {muted ? 'Unmute notifications' : 'Mute notifications'}
            </DropdownMenuItem>
            {canManage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDeleteConversation}
                  className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                >
                  <FiTrash2 className="mr-2 h-4 w-4" /> Delete conversation
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </motion.header>

      {/* Deletion Warning Banner */}
      {conversation.deletionScheduledFor && (
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-orange-400">
            <FiTrash2 className="h-4 w-4" />
            <span>
              This conversation will be deleted in{' '}
              {formatDistanceToNowStrict(new Date(conversation.deletionScheduledFor))}
            </span>
          </div>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelDeletion}
              disabled={isCancellingDeletion}
              className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            >
              {isCancellingDeletion ? 'Cancelling...' : 'Cancel Deletion'}
            </Button>
          )}
        </div>
      )}

      {/* Poll (if exists) */}
      {hasPoll && conversationId && (
        <div className="px-4 py-3 border-b border-black/10 dark:border-white/10">
          <PollDisplay conversationId={conversationId} />
        </div>
      )}

      {/* Body — thread column + members/voice rail on the LEFT (row-reverse) */}
      <div className="flex-1 flex flex-row-reverse min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages — subtle surface so the thread reads as a distinct canvas */}
          <div className="flex-1 overflow-hidden bg-linear-to-b from-muted/30 to-transparent dark:from-white/2">
            <MessageList
              messages={messages}
              users={users}
              conversationId={conversationId!}
              loading={loading}
            />
          </div>

          {/* Input — the composer floats over the thread: a soft gradient fade (not a
              hard footer bar) lets messages scroll up behind it, with a centered
              column that aligns with the message list so it never sprawls. */}
          <div className="bg-linear-to-t from-background via-background/95 to-transparent px-4 pb-4 pt-6">
            <div className="mx-auto w-full max-w-3xl">
              <AnimatePresence>
                {typingName && (
                  <div className="mb-2 px-1">
                    <TypingIndicator label={`${typingName} is typing…`} />
                  </div>
                )}
              </AnimatePresence>
              <MessageInput
                conversationId={conversationId!}
                onMessageSent={fetchMessages}
              />
            </div>
          </div>
        </div>

        {/* Right rail — shared ChatSidebar (members + Discord-like voice) */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeInOut' }}
              className="border-r border-black/5 dark:border-white/8 overflow-hidden shrink-0 bg-background/80 backdrop-blur-xl"
            >
              <div className="w-[300px] h-full">
                <ChatSidebar
                  roomId={conversationId!}
                  self={{ id: currentUser?.id ?? 'me', name: currentUser?.name ?? 'You', image: currentUser?.image ?? null }}
                  isHost={!!canManage}
                  membersTitle={conversation.type === 'GROUP' ? 'Members' : 'People'}
                  members={dmMembers}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
