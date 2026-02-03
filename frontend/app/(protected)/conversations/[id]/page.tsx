'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Pusher from 'pusher-js';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageInput } from '@/components/uicustom/chats/message-input';
import { MessageList } from '@/components/uicustom/chats/message-list';
import { PollDisplay } from '@/components/uicustom/chats/poll-display';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FiArrowLeft, FiTrash2, FiMoreVertical, FiUsers } from 'react-icons/fi';
import { formatDistanceToNowStrict } from 'date-fns';
import Spinner from '@/components/uicustom/spinner';

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

  // Redirect PUBLIC_THREAD to /feed?pulse=id
  useEffect(() => {
    if (conversation?.type === 'PUBLIC_THREAD' && conversationId) {
      router.replace(`/feed?pulse=${conversationId}`);
    }
  }, [conversation?.type, conversationId, router]);

  // Pusher real-time updates
  useEffect(() => {
    if (!conversationId) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    // Subscribe to the correct channel that backend triggers
    const channel = pusher.subscribe(`ConversationChannel_${conversationId}`);
    
    channel.bind('new-message', (data: any) => {
      // Backend sends { conversationId, message: {...} }
      const newMessage = data.message || data;
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    });

    channel.bind('message-deleted', (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`ConversationChannel_${conversationId}`);
    };
  }, [conversationId]);

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
        className="flex items-center gap-4 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm px-4 py-3"
      >
        <Link
          href="/conversations"
          className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <FiArrowLeft className="h-5 w-5 text-zinc-600 dark:text-white/70" />
        </Link>

        {conversation.type === 'PRIVATE_DM' && otherParticipant ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-10 w-10">
              <AvatarImage src={otherParticipant.image || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                {otherParticipant.name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="font-semibold text-zinc-900 dark:text-white truncate">
                {otherParticipant.name || 'Unknown'}
              </h1>
              <p className="text-xs text-zinc-500 dark:text-white/50">Direct Message</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-zinc-900 dark:text-white truncate">
              {conversation.title || 'Untitled Conversation'}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-white/50 flex items-center gap-1">
              {conversation.type === 'GROUP' && <FiUsers className="h-3 w-3" />}
              {conversation.type === 'GROUP' ? 'Group Chat' : conversation.type}
            </p>
          </div>
        )}

        <Button variant="ghost" size="icon" className="text-zinc-500 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10">
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

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          users={users}
          conversationId={conversationId!}
          loading={loading}
        />
      </div>

      {/* Input */}
      <div className="border-t border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-4">
        <MessageInput
          conversationId={conversationId!}
          onMessageSent={fetchMessages}
        />
      </div>
    </div>
  );
}
