'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

interface Conversation {
  id: string;
  title: string;
  companyId: string | null;
}

export const ConversationList: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch('/api/conversations');
        const data = await response.json();
        setConversations(data);
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }
    };

    fetchConversations();
  }, []);

  const handleConversationClick = (id: string) => {
    router.push(`/conversations/${id}`);
  };

  return (
    <div>
      <h2>Your Conversations</h2>
      <ul>
        {conversations.map((conversation) => (
          <li key={conversation.id} onClick={() => handleConversationClick(conversation.id)}>
            {conversation.title}
          </li>
        ))}
      </ul>
    </div>
  );
};