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
import { AnimatePresence } from 'framer-motion';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FiArrowLeft, FiTrash2, FiMoreVertical, FiUsers, FiMessageCircle } from 'react-icons/fi';
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

  return (
    <div className="relative flex flex-col h-[calc(100vh-var(--app-header-offset,64px))]">
      {/* Header */}
      <motion.header
        initial={reduceMotion ? undefined : { opacity: 0, y: -10 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        className="flex items-center gap-3 border-b border-border bg-card/70 backdrop-blur-xl px-4 py-3 z-10"
      >
        <Link
          href="/conversations"
          className="flex items-center justify-center h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <FiArrowLeft className="h-5 w-5" />
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
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={otherParticipant.image || undefined} />
                  <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-600 text-white">
                    {otherParticipant.name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h1 className="font-semibold text-foreground truncate">
                    {otherParticipant.name || 'Unknown'}
                  </h1>
                  <p className="text-xs text-muted-foreground">Direct message</p>
                </div>
              </div>
            </UserHoverCard>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500/15 to-purple-600/15 text-indigo-500 dark:text-indigo-300">
              {conversation.type === 'GROUP' ? <FiUsers className="h-5 w-5" /> : <FiMessageCircle className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-foreground truncate">
                {conversation.title || 'Untitled conversation'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {CONVERSATION_TYPE_LABEL[conversation.type as string] ?? 'Conversation'}
              </p>
            </div>
          </div>
        )}

        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-muted">
          <FiMoreVertical className="h-5 w-5" />
        </Button>
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

      {/* Messages — subtle surface so the thread reads as a distinct canvas */}
      <div className="flex-1 overflow-hidden bg-linear-to-b from-muted/30 to-transparent dark:from-white/2">
        <MessageList
          messages={messages}
          users={users}
          conversationId={conversationId!}
          loading={loading}
        />
      </div>

      {/* Input — full-width dock shell, centered inner column that aligns with
          the message list (max-w-4xl) so the composer never sprawls edge-to-edge. */}
      <div className="border-t border-border bg-card/70 backdrop-blur-xl px-4 pb-4 pt-2">
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
  );
}
