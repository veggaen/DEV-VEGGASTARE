'use client';

import React, { useState, useRef } from 'react';
import { useEdgeStore } from '@/lib/edgestore';
import { UploadCloudIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';

interface MessageInputProps {
  conversationId: string;
  onMessageSent: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({ conversationId, onMessageSent }) => {
  const { edgestore } = useEdgeStore();
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setImage(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: handleDrop,
    accept: { 'image/*': [] },
    multiple: false,
    noClick: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    try {
      let imageUrl = null;

      if (image) {
        const res = await edgestore.myPublicImages.upload({ file: image });
        imageUrl = res.url;
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, content, imageUrl }),
      });

      if (response.ok) {
        setContent('');
        setImage(null);
        onMessageSent();
      } else {
        console.error('Error sending message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-4 mt-4">
      <div
        {...getRootProps()}
        className="dropzone cursor-pointer p-2 rounded-md bg-gray-200 dark:bg-gray-800"
      >
        <input {...getInputProps()} />
        {image ? (
          <p className="text-sm">{image.name}</p>
        ) : (
          <UploadCloudIcon className="h-6 w-6 text-gray-500 dark:text-gray-300" />
        )}
      </div>
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your message"
          className="w-full p-2 border rounded-lg focus:outline-none focus:ring focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          disabled={isSending}
          required={!image}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            handleDrop(files);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (inputRef.current) {
              inputRef.current.style.borderColor = 'blue';
            }
          }}
          onDragLeave={() => {
            if (inputRef.current) {
              inputRef.current.style.borderColor = '';
            }
          }}
        />
      </div>
      <Button
        type="submit"
        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition dark:bg-blue-600 dark:hover:bg-blue-700"
        disabled={isSending || (!content && !image)}
      >
        {isSending ? (
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
        ) : (
          'Send'
        )}
      </Button>
    </form>
  );
};