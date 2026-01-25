'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { useDropzone } from 'react-dropzone';
import { RxCrossCircled } from "react-icons/rx";
import { FaFileUpload } from "react-icons/fa";
import { useEdgeStore } from '@/lib/edgestore';
import Pusher from 'pusher-js';
import Spinner from '../spinner';

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
  loading?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, users, conversationId, loading }) => {
  const currentUser = useCurrentUser();
  const { edgestore } = useEdgeStore();
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [editedImage, setEditedImage] = useState<File | null>(null);
  const [editedImagePreview, setEditedImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalMessages(messages); // Ensure localMessages syncs with the initial messages prop
  }, [messages]);

  useEffect(() => {
    const pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    });
  
    const channel = pusherClient.subscribe(`ConversationChannel_${conversationId}`);
  
    channel.bind('edit-message', (data: any) => {
      setLocalMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, content: data.content, imageUrl: data.imageUrl, editedAt: data.editedAt }
            : msg
        )
      );
    });
  
    channel.bind('delete-message', (data: any) => {
      setLocalMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== data.messageId)
      );
    });
  
    return () => {
      pusherClient.unsubscribe(`ConversationChannel_${conversationId}`);
    };
  }, [conversationId]);

  useEffect(() => {
    // Scroll to the bottom whenever the localMessages change
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [localMessages]);

  const handleEditClick = (message: Message) => {
    setEditingMessageId(message.id);
    setEditedContent(message.content);
    setEditedImagePreview(message.imageUrl || null);
  };

  const handleSaveEdit = async (messageId: string) => {
    setIsSaving(true);
    try {
      let imageUrl = editedImagePreview;
  
      if (editedImage) {
        const res = await edgestore.myPublicImages.upload({ file: editedImage });
        imageUrl = `${res.url}?t=${new Date().getTime()}`; // Add a timestamp to the URL to prevent caching issues
      }
  
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent, imageUrl }),
      });
  
      if (response.ok) {
        setEditingMessageId(null);
        setEditedImage(null);
        setEditedImagePreview(null);
      } else {
        console.error('Error saving edit');
      }
    } catch (error) {
      console.error('Error saving edit:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
      } else {
        console.error('Error deleting message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setEditedImage(acceptedFiles[0]);
      setEditedImagePreview(URL.createObjectURL(acceptedFiles[0]));
    }
  };

  const handleRemoveImage = () => {
    setEditedImage(null);
    setEditedImagePreview(null);
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: handleDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user.name || user.id;
    return acc;
  }, {} as Record<string, string>);

  return (
    <div
      className="space-y-4 p-4 sm:p-6 md:p-8 overflow-y-auto"
      ref={messageListRef} // Ref to the message list container
    >
      {loading ? (
        <div className="flex justify-start">
          <div className="flex flex-col items-center justify-center rounded-lg p-4 max-w-xs md:max-w-md lg:max-w-lg bg-gray-200 text-black dark:bg-gray-700 dark:text-white w-[50%]">
            <div className="text-sm font-semibold">Loading...</div>
            <div className="" style={{ height: '80px' }}>
              <Spinner />
            </div>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {localMessages.map((message) => {
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
                        disabled={isSaving}
                      />
                      <div
                        {...getRootProps()}
                        className="mt-2 cursor-pointer p-2 border rounded-lg bg-gray-200 dark:bg-gray-800"
                      >
                        <input {...getInputProps()} />
                        {editedImagePreview ? (
                          <div className="relative">
                            <img src={editedImagePreview} alt="Edited image" className="w-16 h-16 rounded-lg" />
                            <button
                              type="button"
                              className="absolute top-0 right-0 p-1 rounded-full bg-red-600 text-white hover:bg-red-700"
                              onClick={handleRemoveImage}
                              disabled={isSaving}
                            >
                              <RxCrossCircled className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-center">
                            <FaFileUpload className="h-6 w-6 text-gray-500 dark:text-gray-300 mx-auto" />
                            <p className="text-sm">Drag or click to replace image</p>
                          </div>
                        )}
                      </div>
                      <Button onClick={() => handleSaveEdit(message.id)} disabled={isSaving}>
                        {isSaving ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                        ) : (
                          'Save'
                        )}
                      </Button>
                      <Button onClick={() => setEditingMessageId(null)} disabled={isSaving}>
                        Cancel
                      </Button>
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
                          <Button onClick={() => handleEditClick(message)} disabled={isSaving}>
                            Edit
                          </Button>
                          <Button onClick={() => handleDeleteClick(message.id)} disabled={isSaving}>
                            Delete
                          </Button>
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
      )}
    </div>
  );
};