'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { useDropzone } from 'react-dropzone';
import { RxCrossCircled } from "react-icons/rx";
import { FaFileUpload } from "react-icons/fa";
import { FiEdit2, FiTrash2, FiCheck, FiX, FiImage, FiFlag } from "react-icons/fi";
import { useEdgeStore } from '@/lib/edgestore';
import Pusher from 'pusher-js';
import Spinner from '../spinner';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { UserHoverCard } from '@/components/uicustom/UserHoverCard';
import { ReportDialog } from '@/components/uicustom/report/ReportDialog';

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
  image?: string | null;
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
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);

  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalMessages(messages); // Ensure localMessages syncs with the initial messages prop
  }, [messages]);

  // Auto-scroll to the newest message whenever the list changes.
  useEffect(() => {
    const el = messageListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [localMessages.length]);

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

  const userImageMap = users.reduce((acc, user) => {
    acc[user.id] = user.image ?? null;
    return acc;
  }, {} as Record<string, string | null>);

  // Format timestamp helper
  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, h:mm a');
    }
  };

  return (
    <div
      className="h-full overflow-y-auto px-4 py-6 scroll-smooth"
      ref={messageListRef}
    >
      {loading ? (
        <div className="flex justify-center items-center h-full">
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            <span className="text-sm text-muted-foreground">Loading messages…</span>
          </div>
        </div>
      ) : localMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-sm">No messages yet. Start the conversation!</p>
        </div>
      ) : (
        <div className="space-y-1 max-w-4xl mx-auto">
          {localMessages.map((message, idx) => {
            const isCurrentUser = message.senderId === currentUser?.id;
            const senderName = userMap[message.senderId] || message.senderId;
            const senderImage = userImageMap[message.senderId] ?? null;
            const canModify = isCurrentUser || currentUser?.role === 'ADMIN';
            const isEditing = editingMessageId === message.id;

            const prevMessage = idx > 0 ? localMessages[idx - 1] : null;
            // Group consecutive messages from the same sender; show the avatar/name
            // only on the first message of a run.
            const isGroupStart = !prevMessage || prevMessage.senderId !== message.senderId;
            const showSender = !isCurrentUser && isGroupStart;
            const showAvatar = !isCurrentUser && isGroupStart;

            // Date separator when the day changes (or on the very first message).
            const showDateSeparator =
              !prevMessage ||
              !isSameDay(new Date(prevMessage.createdAt), new Date(message.createdAt));
            const dateLabel = (() => {
              const d = new Date(message.createdAt);
              if (isToday(d)) return 'Today';
              if (isYesterday(d)) return 'Yesterday';
              return format(d, 'MMMM d, yyyy');
            })();

            return (
              <React.Fragment key={message.id}>
                {showDateSeparator && (
                  <div className="flex items-center justify-center py-4">
                    <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      {dateLabel}
                    </span>
                  </div>
                )}
              <div
                className={cn(
                  "group flex items-end gap-2 max-w-[85%] md:max-w-[70%]",
                  isCurrentUser ? "ml-auto flex-row-reverse" : "mr-auto",
                  isGroupStart ? "mt-3" : "mt-0.5",
                )}
              >
                {/* Avatar for incoming messages (only at the start of a run) */}
                {!isCurrentUser && (
                  <div className="w-8 shrink-0">
                    {showAvatar && (
                      <UserHoverCard userId={message.senderId} userName={senderName} side="top" align="start">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={senderImage || undefined} />
                          <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-600 text-white text-xs">
                            {senderName?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                      </UserHoverCard>
                    )}
                  </div>
                )}

                {/* Message Bubble */}
                <div className="flex flex-col min-w-0">
                  {showSender && (
                    <div className="mb-1 px-1">
                      <UserHoverCard userId={message.senderId} userName={senderName} side="top" align="start">
                        <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                          {senderName}
                        </span>
                      </UserHoverCard>
                    </div>
                  )}

                  <div
                    className={cn(
                      "relative rounded-2xl px-4 py-2.5 shadow-sm transition-all",
                      isCurrentUser
                        ? "bg-linear-to-br from-indigo-500 to-purple-600 text-white rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md border border-border/60",
                    )}
                  >
                    {isEditing ? (
                      /* Edit Mode */
                      <div className="space-y-3 min-w-[250px]">
                        <input
                          type="text"
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="Edit message..."
                          disabled={isSaving}
                          autoFocus
                        />

                        {/* Image Upload Zone */}
                        <div
                          {...getRootProps()}
                          className="cursor-pointer rounded-lg border-2 border-dashed border-border hover:border-foreground/40 transition-colors p-3"
                        >
                          <input {...getInputProps()} />
                          {editedImagePreview ? (
                            <div className="relative inline-block">
                              <Image
                                src={editedImagePreview}
                                alt="Edited"
                                width={80}
                                height={80}
                                unoptimized
                                className="w-20 h-20 rounded-lg object-cover"
                              />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                                disabled={isSaving}
                                className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                              >
                                <RxCrossCircled className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
                              <FiImage className="h-4 w-4" />
                              <span>Add image</span>
                            </div>
                          )}
                        </div>

                        {/* Save/Cancel Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveEdit(message.id)}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {isSaving ? (
                              <div className="animate-spin h-3.5 w-3.5 border-2 border-green-400 border-t-transparent rounded-full" />
                            ) : (
                              <FiCheck className="h-3.5 w-3.5" />
                            )}
                            Save
                          </button>
                          <button
                            onClick={() => setEditingMessageId(null)}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            <FiX className="h-3.5 w-3.5" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal Message View */
                      <>
                        <p className="text-[15px] leading-relaxed break-words break-all whitespace-pre-wrap">
                          {message.content}
                        </p>
                        
                        {message.imageUrl && (
                          <div className="mt-2">
                            <Image
                              src={message.imageUrl}
                              alt="Attachment"
                              width={512}
                              height={512}
                              unoptimized
                              className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(message.imageUrl, '_blank')}
                            />
                          </div>
                        )}
                        
                        {/* Timestamp & Edited indicator */}
                        <div className={cn(
                          "flex items-center gap-1.5 mt-1.5 text-[11px]",
                          isCurrentUser ? "text-white/70" : "text-muted-foreground"
                        )}>
                          <span>{formatMessageTime(message.createdAt)}</span>
                          {message.editedAt && (
                            <>
                              <span>·</span>
                              <span className="italic">edited</span>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Hover Actions - Only show when not editing */}
                {canModify && !isEditing && (
                  <div className={cn(
                    "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                    isCurrentUser ? "flex-row-reverse" : ""
                  )}>
                    <button
                      onClick={() => handleEditClick(message)}
                      disabled={isSaving}
                      className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                      title="Edit message"
                    >
                      <FiEdit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(message.id)}
                      disabled={isSaving}
                      className="p-2 rounded-full hover:bg-red-500/15 text-muted-foreground hover:text-red-500 transition-all"
                      title="Delete message"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {/* Report button - visible on other people's messages */}
                {!isCurrentUser && !isEditing && (
                  <div className={cn(
                    "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  )}>
                    <button
                      onClick={() => setReportMessageId(message.id)}
                      className="p-2 rounded-full hover:bg-red-500/15 text-muted-foreground hover:text-red-500 transition-all"
                      title="Rapporter melding"
                    >
                      <FiFlag className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Report Dialog */}
      <ReportDialog
        open={!!reportMessageId}
        onOpenChange={(open) => { if (!open) setReportMessageId(null); }}
        contentType="MESSAGE"
        contentId={reportMessageId || ''}
        contentLabel="denne meldingen"
      />
    </div>
  );
};