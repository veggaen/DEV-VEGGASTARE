'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Pusher from 'pusher-js';
import { MessageInput } from '@/components/uicustom/chats/message-input';
import { MessageList } from '@/components/uicustom/chats/message-list';
import { PollDisplay } from '@/components/uicustom/chats/poll-display';
import { useCurrentUser } from '@/hooks/use-current-user';
import { User } from '@prisma/client';
import { FiTrash2, FiX } from 'react-icons/fi';
import { formatDistanceToNowStrict } from 'date-fns';
import { Button } from '@/components/ui/button';

interface ConversationPageProps {
  params: Promise<{ id: string }>;
}

interface ConversationDetails {
  id: string;
  title: string | null;
  deletionRequestedAt: string | null;
  deletionScheduledFor: string | null;
  deletionVisibility: 'PUBLIC' | 'PRIVATE' | null;
  isAnonymized: boolean;
  userId: string;
  originalUserId: string | null;
}

const ConversationPage: React.FC<ConversationPageProps> = ({ params }) => {
  const { id: conversationId } = use(params);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [isCancellingDeletion, setIsCancellingDeletion] = useState(false);

  const currentUser = useCurrentUser();

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/messages?conversationId=${conversationId}`);
      const data = await response.json();
      if (data.messages && data.users) {
        setMessages(data.messages);
        setUsers(data.users);
      } else {
        console.error('Invalid data format from API:', data);
      }
      // Also fetch conversation details for deletion status
      if (data.conversation) {
        setConversation(data.conversation);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Cancel pending deletion
  const handleCancelDeletion = async () => {
    if (!conversation) return;
    setIsCancellingDeletion(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}?cancel=true`, {
        method: 'DELETE',
      });
      if (response.ok) {
        // Refresh to get updated conversation state
        fetchMessages();
      }
    } catch (error) {
      console.error('Failed to cancel deletion:', error);
    } finally {
      setIsCancellingDeletion(false);
    }
  };

  // Check if current user can cancel deletion (creator or admin)
  const canCancelDeletion = currentUser && conversation && (
    currentUser.id === conversation.userId ||
    currentUser.id === conversation.originalUserId ||
    (currentUser as any).role === 'ADMIN' ||
    (currentUser as any).role === 'OWNER'
  );

  // Track view for "reach over followers" metrics
  // Only track once per session per conversation to prevent inflated counts
  useEffect(() => {
    const trackView = async () => {
      // Check if we've already tracked this view in this session
      const viewedKey = `conversation_viewed_${conversationId}`;
      if (typeof window !== 'undefined' && sessionStorage.getItem(viewedKey)) {
        return; // Already viewed in this session
      }

      try {
        await fetch(`/api/conversations/${conversationId}/view`, { method: 'POST' });
        // Mark as viewed in this session
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(viewedKey, 'true');
        }
      } catch (error) {
        // Silent fail - view tracking shouldn't break the page
        console.debug('View tracking failed:', error);
      }
    };
    trackView();
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();

    const pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    });

    const channel = pusherClient.subscribe(`ConversationChannel_${conversationId}`);

    const handleNewMessage = (data: any) => {
      setMessages((prevMessages) => [...prevMessages, data.message]);
    };

    const handleEditMessage = (data: any) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, content: data.content, editedAt: data.editedAt }
            : msg
        )
      );
    };

    const handleDeleteMessage = (data: any) => {
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== data.messageId)
      );
    };

    channel.bind('new-message', handleNewMessage);
    channel.bind('edit-message', handleEditMessage);
    channel.bind('delete-message', handleDeleteMessage);

    return () => {
      channel.unbind('new-message', handleNewMessage);
      channel.unbind('edit-message', handleEditMessage);
      channel.unbind('delete-message', handleDeleteMessage);
      pusherClient.unsubscribe(`ConversationChannel_${conversationId}`);
    };
  }, [conversationId, fetchMessages]);

  const refreshMessages = useCallback(() => {
    fetchMessages();
  }, [fetchMessages]);

  return (
    <div className="flex flex-col h-[calc(100%-102px)] bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 md:p-8 space-y-2">
      {/* Pending deletion banner */}
      {conversation?.deletionScheduledFor && (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg ${
          conversation.deletionVisibility === 'PUBLIC'
            ? 'bg-orange-100 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800'
            : 'bg-muted/50 border border-border'
        }`}>
          <div className="flex items-center gap-2 text-sm">
            <FiTrash2 className={`h-4 w-4 flex-shrink-0 ${
              conversation.deletionVisibility === 'PUBLIC' ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'
            }`} />
            <span className={conversation.deletionVisibility === 'PUBLIC' ? 'text-orange-800 dark:text-orange-200' : 'text-muted-foreground'}>
              {conversation.deletionVisibility === 'PUBLIC'
                ? `This thread will be deleted in ${formatDistanceToNowStrict(new Date(conversation.deletionScheduledFor))}`
                : 'Deletion pending'
              }
            </span>
          </div>
          {canCancelDeletion && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelDeletion}
              disabled={isCancellingDeletion}
              className="text-xs gap-1"
            >
              <FiX className="h-3 w-3" />
              Cancel
            </Button>
          )}
        </div>
      )}

      <p className='flex flex-col md:flex-row justify-between items-center w-full px-4 py-4 bg-white dark:bg-black/40 transition-colors duration-300 rounded'>
        {conversation?.isAnonymized ? (
          <span className="italic text-muted-foreground">[Deleted User]</span>
        ) : (
          users.map((user: User) => user.name).join(', ')
        )}
      </p>

      {/* Poll display - shows if conversation has a poll */}
      <PollDisplay conversationId={conversationId} />

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 bg-white dark:bg-black/40 rounded-lg shadow-md">
        <MessageList messages={messages} users={users} conversationId={conversationId} loading={loading} />
      </div>
      <div className="mt-4">
        <MessageInput conversationId={conversationId} onMessageSent={refreshMessages} />
      </div>
    </div>
  );
};

export default ConversationPage;