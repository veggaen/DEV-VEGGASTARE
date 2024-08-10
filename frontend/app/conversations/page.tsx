'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StartConversationForm from '@/components/uicustom/chats/start-conversation';

interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  referredBy?: string;
}

interface Conversation {
  id: string;
  title: string;
  participants: User[];
  messages: any[]; // Add the appropriate type here
}

const ConversationsPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch('/api/conversations');
        const data = await response.json();

        if (Array.isArray(data)) {
          setConversations(data);
        } else {
          throw new Error('Unexpected response format');
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);

        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError('An unknown error occurred');
        }
      }
    };

    fetchConversations();
  }, []);

  const handleConversationClick = (id: string) => {
    router.push(`/conversations/${id}`);
  };

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="flex flex-col justify-start items-center p-4">
      <div className='w-full'>
        <StartConversationForm />
      </div>
      <div className='w-full md:max-w-[1440px]'>
        <h2 className="text-2xl font-bold mb-4">Your Conversations</h2>
        {conversations.length === 0 ? (
            <p>No conversations available.</p>
          ) : (
              <ul className="space-y-4">
            {conversations.map((conversation) => (
                <li
                key={conversation.id}
                onClick={() => handleConversationClick(conversation.id)}
                className="cursor-pointer bg-white dark:bg-gray-800 p-4 rounded shadow hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                <div className="font-semibold capitalize">{conversation.title || conversation.id}</div>
                <div className="text-gray-500 dark:text-gray-400 text-sm">
                  Participants: {conversation.participants.map((user) => user.name || user.id).join(', ')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ConversationsPage;