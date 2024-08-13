import React, { useState } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';

interface Message {
  id: string;
  content: string;
  imageUrl?: string;
  senderId: string;
  createdAt: string;
  editedAt?: string;
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

export const MessageList: React.FC<MessageListProps> = ({ messages = [], users = [] }) => {
  const currentUser = useCurrentUser();
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');

  const handleEditClick = (message: Message) => {
    setEditingMessageId(message.id);
    setEditedContent(message.content);
  };

  const handleSaveEdit = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent }),
      });

      if (response.ok) {
        setEditingMessageId(null);
        // Pusher will update the UI, no need to manually refresh
      } else {
        console.error('Error saving edit');
      }
    } catch (error) {
      console.error('Error saving edit:', error);
    }
  };

  const handleDeleteClick = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Pusher will update the UI, no need to manually refresh
      } else {
        console.error('Error deleting message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user.name || user.id;
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="space-y-4 p-4 sm:p-6 md:p-8 overflow-y-auto">
      <ul className="space-y-2">
        {messages.map((message) => {
          const isCurrentUser = message.senderId === currentUser?.id;
          const senderName = userMap[message.senderId] || message.senderId;

          return (
            <li key={message.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`rounded-lg p-4 max-w-xs md:max-w-md lg:max-w-lg ${
                  isCurrentUser ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black dark:bg-gray-700 dark:text-white'
                }`}
              >
                <div className="text-sm font-semibold">
                  {isCurrentUser ? 'You' : senderName}
                </div>
                {editingMessageId === message.id ? (
                  <>
                    <input
                      type="text"
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    />
                    <Button onClick={() => handleSaveEdit(message.id)}>Save</Button>
                    <Button onClick={() => setEditingMessageId(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <div>{message.content}</div>
                    {message.imageUrl && (
                      <div className="mt-2">
                        <img src={message.imageUrl} alt="Uploaded" className="rounded-lg max-w-full" />
                      </div>
                    )}
                    {message.editedAt && (
                      <div className="text-xs text-gray-400 mt-1">Edited</div>
                    )}
                    {(isCurrentUser || currentUser?.role === 'ADMIN') && (
                      <div className="flex space-x-2 mt-2">
                        <Button onClick={() => handleEditClick(message)}>Edit</Button>
                        <Button onClick={() => handleDeleteClick(message.id)}>Delete</Button>
                      </div>
                    )}
                  </>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(message.createdAt).toLocaleString()}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};