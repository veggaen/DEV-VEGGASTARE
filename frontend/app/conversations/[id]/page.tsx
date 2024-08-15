'use client';

import { useEffect, useState, useCallback } from 'react';
import Pusher from 'pusher-js';
import { MessageInput } from '@/components/uicustom/chats/message-input';
import { MessageList } from '@/components/uicustom/chats/message-list';
import { useCurrentUser } from '@/hooks/use-current-user';
import { User } from '@prisma/client';

interface ConversationPageProps {
  params: { id: string };
}

const ConversationPage: React.FC<ConversationPageProps> = ({ params }) => {
  const conversationId = params.id;
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
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
      <p className='flex flex-col md:flex-row justify-between items-center w-full px-4 py-4 bg-white dark:bg-black/40 transition-colors duration-300 rounded'>
        {users.map((user: User) => {
          return `${user.name}`;
        }).join(', ')}
      </p>
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