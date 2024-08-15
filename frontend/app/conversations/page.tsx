'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StartConversationForm from '@/components/uicustom/chats/start-conversation';
import Spinner from '@/components/uicustom/spinner';

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
  messages: any[];
}

const ConversationsPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState<string | null>(null);
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
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, []);

  const handleConversationClick = (id: string) => {
    setIsNavigating(id); // Set the id of the conversation being navigated
    router.push(`/conversations/${id}`);
  };

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="flex flex-col justify-start items-center p-4">
      <div className="w-full">
        <StartConversationForm />
      </div>
      <div className="w-full md:max-w-[1440px]">
        <h2 className="text-2xl font-bold mb-4">Your Conversations</h2>
        {isLoading ? (
          <div className="flex flex-col items-center">
            <ul className="space-y-4 w-full">
              {[...Array(1)].map((_, index) => (
                <li
                  key={index}
                  className="bg-white dark:bg-gray-800 p-4 rounded shadow animate-pulse flex justify-center items-center"
                  style={{ height: '80px' }}
                >
                  <Spinner />
                </li>
              ))}
            </ul>
          </div>
        ) : conversations.length === 0 ? (
          <p>No conversations available.</p>
        ) : (
          <ul className="space-y-4">
            {conversations.map((conversation) => (
              <li
                key={conversation.id}
                onClick={() => handleConversationClick(conversation.id)}
                className="cursor-pointer bg-white dark:bg-gray-800 p-4 rounded shadow hover:bg-gray-200 dark:hover:bg-gray-700 transition relative"
                style={{ position: 'relative' }}
              >
                {isNavigating === conversation.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-black dark:bg-opacity-50">
                    <Spinner />
                  </div>
                )}
                <div className="font-semibold capitalize">
                  {conversation.title || conversation.id}
                </div>
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