'use client';

import React, { useState, useRef } from 'react';
import { useEdgeStore } from '@/lib/edgestore';
import { UploadCloudIcon, XCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';

interface MessageInputProps {
  conversationId: string;
  onMessageSent: () => void;
  isEditing?: boolean;
  initialContent?: string;
  initialImageUrl?: string;
  messageId?: string;
  onCancelEdit?: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  conversationId,
  onMessageSent,
  isEditing = false,
  initialContent = '',
  initialImageUrl = '',
  messageId,
  onCancelEdit,
}) => {
  const { edgestore } = useEdgeStore();
  const [content, setContent] = useState(initialContent);
  const [isSending, setIsSending] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialImageUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setImage(acceptedFiles[0]);
      setImagePreview(URL.createObjectURL(acceptedFiles[0]));
    }
  };

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: handleDrop,
    accept: { 'image/*': [] },
    multiple: false,
    noClick: true, // Prevent automatic file dialog when clicking the dropzone
  });

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    try {
      let imageUrl = imagePreview;

      if (image) {
        const res = await edgestore.myPublicImages.upload({ file: image });
        imageUrl = res.url;
      }

      const payload = {
        conversationId,
        content,
        imageUrl: imageUrl || null,
      };

      const apiEndpoint = isEditing && messageId ? `/api/messages/${messageId}` : '/api/messages';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(apiEndpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setContent('');
        setImage(null);
        setImagePreview(null);
        onMessageSent();
        if (isEditing && onCancelEdit) onCancelEdit();
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
        onClick={open} // Trigger the file input dialog on click
      >
        <input {...getInputProps()} />
        {imagePreview ? (
          <div className="relative">
            <img src={imagePreview} alt="Selected image" className="w-16 h-16 rounded-lg" />
            <button
              type="button"
              className="absolute top-0 right-0 p-1 rounded-full bg-red-600 text-white hover:bg-red-700"
              onClick={handleRemoveImage}
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
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
          required={!imagePreview}
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
        disabled={isSending || (!content && !imagePreview)}
      >
        {isSending ? (
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
        ) : (
          isEditing ? 'Save' : 'Send'
        )}
      </Button>
      {isEditing && (
        <Button
          type="button"
          className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition dark:bg-gray-600 dark:hover:bg-gray-700"
          onClick={onCancelEdit}
          disabled={isSending}
        >
          Cancel
        </Button>
      )}
    </form>
  );
};