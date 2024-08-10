import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
}

interface MessageListProps {
  messages: Message[];
  users: User[];
  conversationId: string;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const diffMinutes = Math.floor((diff / 1000 / 60) % 60);
  const diffSeconds = Math.floor((diff / 1000) % 60);

  if (diffDays > 0) {
    return `${diffDays} days ${diffHours} hours ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hours ${diffMinutes} min ago`;
  }
  if (diffMinutes > 0) {
    return `${diffMinutes} min ${diffSeconds} sec ago`;
  }
  return `${diffSeconds} sec ago`;
};

export const MessageList: React.FC<MessageListProps> = ({ messages = [], users = [] }) => {
  const currentUser = useCurrentUser();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user.name || user.id;
    return acc;
  }, {} as Record<string, string>);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if the user has scrolled up
    const isScrolledToBottom =
      container.scrollHeight - container.scrollTop === container.clientHeight;

    setIsAtBottom(isScrolledToBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom, scrollToBottom]);

  useEffect(() => {
    const container = containerRef.current;

    // Scroll to bottom on initial load
    if (container) {
      container.scrollTop = container.scrollHeight;
    }

    // Attach scroll event listener
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [handleScroll]);

  return (
    <div
      ref={containerRef}
      className="space-y-4 p-4 sm:p-6 md:p-8 lg:p-1overflow-y-auto"
      style={{ maxHeight: '100%' }}
    >
      <ul className="space-y-2">
        {messages.map((message) => {
          const isCurrentUser = message.senderId === currentUser?.id;
          const senderName = userMap[message.senderId] || message.senderId;

          return (
            <li
              key={message.id}
              className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-lg p-4 max-w-xs md:max-w-md lg:max-w-lg ${
                  isCurrentUser
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-black dark:bg-gray-700 dark:text-white'
                }`}
              >
                <div className="text-sm font-semibold">
                  {isCurrentUser ? 'You' : senderName}
                </div>
                <div>{message.content}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatDate(message.createdAt)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};