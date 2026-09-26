'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import Image from 'next/image';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useDropzone } from 'react-dropzone';
import { RxCrossCircled } from "react-icons/rx";
import { FiEdit2, FiTrash2, FiCheck, FiX, FiImage, FiFlag } from "react-icons/fi";
import { useEdgeStore } from '@/lib/edgestore';
import { toast } from 'sonner';
import { useConfirm } from '@/components/providers/confirm-dialog';
import Spinner from '../spinner';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { UserHoverCard } from '@/components/uicustom/UserHoverCard';
import { ReportDialog } from '@/components/uicustom/report/ReportDialog';
import { motion, useReducedMotion } from 'framer-motion';
import { ScrollToBottom } from './primitives/ScrollToBottom';
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
  image?: string | null;
}

interface MessageListProps {
  messages: Message[];
  users: User[];
  conversationId: string;
  loading?: boolean;
  onChanged?: () => void;
  allowImages?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, users, loading, onChanged, allowImages = true }) => {
  const confirm = useConfirm();
  const currentUser = useCurrentUser();
  const reduceMotion = useReducedMotion();
  const { edgestore } = useEdgeStore();
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [editedImage, setEditedImage] = useState<File | null>(null);
  const [editedImagePreview, setEditedImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);

  const messageListRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followLatestRef = useRef(true);
  const viewportHeightRef = useRef(0);
  const previousListRef = useRef({ count: 0, lastId: '' });

  useEffect(() => {
    setLocalMessages(messages); // Ensure localMessages syncs with the initial messages prop
  }, [messages]);

  // Follow new messages only while already near the bottom, or after our own
  // new send. Refetches, edits and incoming replies must not interrupt reading.
  useLayoutEffect(() => {
    const el = messageListRef.current;
    const last = localMessages.at(-1);
    const previous = previousListRef.current;
    const ownAppend = localMessages.length > previous.count && last?.id !== previous.lastId && last?.senderId === currentUser?.id;
    if (el && (followLatestRef.current || ownAppend)) {
      el.scrollTop = el.scrollHeight;
      followLatestRef.current = true;
    }
    if (el) viewportHeightRef.current = el.clientHeight;
    previousListRef.current = { count: localMessages.length, lastId: last?.id ?? '' };
  }, [localMessages, currentUser?.id]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      const el = messageListRef.current;
      if (el) {
        if (followLatestRef.current) el.scrollTop = el.scrollHeight;
        viewportHeightRef.current = el.clientHeight;
      }
    });
    observer.observe(content);
    if (messageListRef.current) observer.observe(messageListRef.current);
    return () => observer.disconnect();
  }, []);

  const handleEditClick = (message: Message) => {
    setEditingMessageId(message.id);
    setEditedImage(null);
    setEditedContent(message.content);
    setEditedImagePreview(message.imageUrl || null);
  };

  const handleSaveEdit = async (messageId: string) => {
    setIsSaving(true);
    try {
      let imageUrl = editedImagePreview;
  
      if (editedImage && allowImages) {
        const res = await edgestore.myPublicImages.upload({ file: editedImage });
        imageUrl = `${res.url}?t=${new Date().getTime()}`; // Add a timestamp to the URL to prevent caching issues
      }
  
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent, imageUrl }),
      });
  
      if (response.ok) {
        const saved = await response.json();
        setLocalMessages(previous => previous.map(message => message.id === messageId ? { ...message, ...saved } : message));
        setEditingMessageId(null);
        setEditedImage(null);
        setEditedImagePreview(null);
        onChanged?.();
      } else {
        toast.error('Could not save the message. Your edit is still here.');
      }
    } catch {
      toast.error('Could not save the message. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = async (messageId: string) => {
    if (!await confirm({ title: 'Delete this message?', description: 'This cannot be undone.', confirmLabel: 'Delete message', destructive: true })) return;
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setLocalMessages(previous => previous.filter(message => message.id !== messageId));
        onChanged?.();
      } else {
        toast.error('Could not delete the message. Try again.');
      }
    } catch {
      toast.error('Could not delete the message. Try again.');
    }
  };

  const handleDrop = (acceptedFiles: File[]) => {
    if (!allowImages) return;
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
    disabled: !allowImages || isSaving,
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
    <div className="relative h-full min-h-0">
    <div
      role="region"
      aria-label="Conversation messages"
      tabIndex={0}
      className="h-full overflow-y-auto overscroll-contain px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      ref={messageListRef}
      onScroll={event => {
        const el = event.currentTarget;
        // Growing the composer is a layout change, not a request to stop following.
        if (el.clientHeight === viewportHeightRef.current) followLatestRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
    >
      <div ref={contentRef} className="mx-auto min-h-full w-full max-w-3xl">
      {loading ? (
        <div className="flex justify-center items-center h-full">
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            <span className="text-sm text-muted-foreground">Loading messages…</span>
          </div>
        </div>
      ) : localMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-indigo-500/10 text-2xl mb-4">💬</div>
          <p className="text-base font-medium text-foreground">No messages yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Say hello — your first message starts the conversation.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
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
              <motion.div
                initial={
                  reduceMotion
                    ? false
                    : { opacity: 0, y: 4 }
                }
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.16 }}
                className={cn(
                  "group flex w-fit max-w-full items-end gap-1.5 sm:max-w-[88%] sm:gap-2",
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
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
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
                      "relative rounded-2xl border px-4 py-2.5",
                      isCurrentUser
                        ? "bg-primary/10 border-primary/20 text-foreground rounded-br-md"
                        : "bg-card text-foreground rounded-bl-md border-border",
                    )}
                  >
                    {isEditing ? (
                      /* Edit Mode */
                      <div className="space-y-3 min-w-0 w-64 max-w-full">
                        <textarea
                          aria-label="Edit message"
                          rows={3}
                          maxLength={5000}
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="min-h-11 max-h-40 w-full resize-y px-3 py-2 text-base rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          placeholder="Edit message..."
                          disabled={isSaving}
                          autoFocus
                        />

                        {/* Image Upload Zone */}
                        {(allowImages || editedImagePreview) && <div
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
                                aria-label="Remove image from message"
                                onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                                disabled={isSaving}
                                className="absolute -top-2 -right-2 grid size-11 place-items-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <RxCrossCircled className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                              <FiImage className="h-4 w-4" />
                              <span>Add image</span>
                            </div>
                          )}
                        </div>}

                        {/* Save/Cancel Buttons */}
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleSaveEdit(message.id)}
                            disabled={isSaving}
                            className="min-h-11 gap-1.5"
                          >
                            {isSaving ? (
                              <div className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                            ) : (
                              <FiCheck className="h-3.5 w-3.5" />
                            )}
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setEditingMessageId(null)}
                            disabled={isSaving}
                            className="min-h-11 gap-1.5"
                          >
                            <FiX className="h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Normal Message View */
                      <>
                        <p className="text-[15px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap">
                          {message.content}
                        </p>
                        
                        {message.imageUrl && (
                          <a href={message.imageUrl} target="_blank" rel="noopener noreferrer" aria-label="Open message attachment" className="mt-2 block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <Image
                              src={message.imageUrl}
                              alt="Message attachment"
                              width={512}
                              height={512}
                              unoptimized
                              className="rounded-lg max-w-full max-h-64 object-contain hover:opacity-90 transition-opacity"
                            />
                          </a>
                        )}
                        
                        {/* Timestamp & Edited indicator */}
                        <div className={cn(
                          "flex items-center gap-1.5 mt-1.5 text-[11px]",
                          "text-muted-foreground"
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
                    "flex shrink-0 items-center opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150",
                    isCurrentUser ? "flex-row-reverse" : ""
                  )}>
                    <button
                      onClick={() => handleEditClick(message)}
                      disabled={isSaving}
                      className="grid size-11 place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Edit message"
                      aria-label="Edit message"
                    >
                      <FiEdit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(message.id)}
                      disabled={isSaving}
                      className="grid size-11 place-items-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Delete message"
                      aria-label="Delete message"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {/* Report button - visible on other people's messages */}
                {!isCurrentUser && !isEditing && (
                  <div className={cn(
                    "flex shrink-0 items-center opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150"
                  )}>
                    <button
                      onClick={() => setReportMessageId(message.id)}
                      className="grid size-11 place-items-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Rapporter melding"
                      aria-label="Report message"
                    >
                      <FiFlag className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </motion.div>
              </React.Fragment>
            );
          })}
        </div>
      )}
      </div>
    </div>
      {/* Floating scroll-to-latest button (appears when scrolled up) */}
      <ScrollToBottom containerRef={messageListRef} />

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
