'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useEdgeStore } from '@/lib/edgestore';
import { RxCrossCircled } from "react-icons/rx";
import { FaFileUpload } from "react-icons/fa";
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FiArrowUp, FiSmile } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface MessageInputProps {
  conversationId: string;
  onMessageSent: () => void;
  isEditing?: boolean;
  initialContent?: string;
  initialImageUrl?: string;
  messageId?: string;
  onCancelEdit?: () => void;
  parentId?: string | null;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  conversationId,
  onMessageSent,
  isEditing = false,
  initialContent = '',
  initialImageUrl = '',
  messageId,
  onCancelEdit,
  parentId,
}) => {
  const { edgestore } = useEdgeStore();
  const MAX_CHARS = 2000;
  const TEXTAREA_MAX_HEIGHT = 180; // px
  const [content, setContent] = useState(initialContent);
  const [isSending, setIsSending] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialImageUrl);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isTextareaScrollable, setIsTextareaScrollable] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const draftKey = useMemo(() => `chat_draft:${conversationId}`, [conversationId]);

  // Quick-access emoji row (additive — full picker can come later). Inserts at
  // the caret so it composes naturally with typed text.
  const QUICK_EMOJI = ['😀', '😂', '❤️', '👍', '🔥', '🎉', '🙏', '😅', '😎', '🤝', '💯', '👀'];
  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((c) => c + emoji);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
      resizeTextarea();
    });
  };

  const canSend = useMemo(() => Boolean(content.trim()) || Boolean(imagePreview), [content, imagePreview]);
  const isTooLong = content.length > MAX_CHARS;
  const showMeta = isFocused || content.length > 0 || Boolean(imagePreview);
  const showCounter = isFocused || content.length > Math.floor(MAX_CHARS * 0.8) || isTooLong;

  // Draft persistence (text only). Skips edit mode.
  useEffect(() => {
    if (isEditing) return;
    if (typeof window === 'undefined') return;
    if (initialContent?.trim()) return;

    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved && !content) {
        setContent(saved);
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
          resizeTextarea();
        });
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, isEditing]);

  useEffect(() => {
    if (isEditing) return;
    if (typeof window === 'undefined') return;

    const handle = window.setTimeout(() => {
      try {
        const trimmed = content.trim();
        if (!trimmed) {
          window.localStorage.removeItem(draftKey);
          return;
        }
        window.localStorage.setItem(draftKey, content);
      } catch {
        // ignore
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [content, draftKey, isEditing]);

  // Auto-resize textarea up to a max height; then it becomes scrollable.
  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT);
    el.style.height = `${nextHeight}px`;
    // Only show scrollbar when content exceeds our max height.
    setIsTextareaScrollable(el.scrollHeight > TEXTAREA_MAX_HEIGHT + 1);
  };

  useEffect(() => {
    resizeTextarea();
  }, [content]);

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
    if (!canSend || isSending || isTooLong) return;
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
        ...(parentId ? { parentId } : {}),
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
        if (!isEditing && typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem(draftKey);
          } catch {
            // ignore
          }
        }
        onMessageSent();
        if (isEditing && onCancelEdit) onCancelEdit();
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            resizeTextarea();
          }
        });
      } else {
        // Parse error details from response
        let errorMessage = 'Failed to send message';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Fallback to status text
          errorMessage = `Error ${response.status}: ${response.statusText || 'Failed to send message'}`;
        }
        console.error('Error sending message:', errorMessage);
        // Import toast at top if not already imported
        const { toast } = await import('sonner');
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const { toast } = await import('sonner');
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div
        {...getRootProps()}
        className={cn(
          'rounded-3xl border bg-white/80 dark:bg-zinc-900/70 backdrop-blur-sm shadow-sm',
          'border-zinc-200/80 dark:border-white/10',
          'px-4 py-3'
        )}
      >
        <input {...getInputProps()} />

        {imagePreview && (
          <div className="mb-3">
            <div className="relative inline-block">
              <Image
                src={imagePreview}
                alt="Selected image"
                width={112}
                height={112}
                unoptimized
                className="h-28 w-28 rounded-xl object-cover border border-black/10 dark:border-white/10"
              />
              <button
                type="button"
                className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 shadow"
                onClick={handleRemoveImage}
                aria-label="Remove image"
              >
                <RxCrossCircled className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Quick-emoji popover */}
        <AnimatePresence>
          {showEmoji && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="mb-2 flex flex-wrap gap-1 rounded-2xl border border-zinc-200/80 bg-white/90 p-2 shadow-sm dark:border-white/10 dark:bg-zinc-900/90"
            >
              {QUICK_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => insertEmoji(e)}
                  className="rounded-lg px-1.5 py-1 text-lg transition-transform hover:scale-125 hover:bg-zinc-100 dark:hover:bg-white/10"
                  aria-label={`Insert ${e}`}
                >
                  {e}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={open}
            disabled={isSending}
            className={cn(
              'shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full border transition',
              'border-zinc-200/80 dark:border-white/10',
              'bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10',
              'text-zinc-700 dark:text-white/70 hover:scale-105 active:scale-95'
            )}
            aria-label="Attach image"
            title="Attach image"
          >
            <FaFileUpload className="h-5 w-5" />
          </button>

          {/* Emoji toggle (additive) */}
          <button
            type="button"
            onClick={() => setShowEmoji((s) => !s)}
            disabled={isSending}
            className={cn(
              'shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full border transition',
              'border-zinc-200/80 dark:border-white/10',
              'bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10',
              'hover:scale-105 active:scale-95',
              showEmoji
                ? 'text-sky-500 dark:text-emerald-400'
                : 'text-zinc-700 dark:text-white/70',
            )}
            aria-label="Insert emoji"
            title="Emoji"
          >
            <FiSmile className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div
              className={cn(
                'rounded-2xl bg-zinc-50/80 dark:bg-white/5 overflow-hidden',
                'ring-1 ring-zinc-200/70 dark:ring-white/10',
                'focus-within:ring-2 focus-within:ring-zinc-400/60 dark:focus-within:ring-white/20'
              )}
            >
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write a message…"
                className={cn(
                  'w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-relaxed',
                  'text-zinc-900 dark:text-white',
                  'placeholder:text-zinc-500 dark:placeholder:text-white/40 focus:outline-none',
                  isTextareaScrollable ? 'overflow-y-auto pr-6' : 'overflow-y-hidden'
                )}
                disabled={isSending}
                rows={1}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit(e as unknown as React.FormEvent);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files);
                  handleDrop(files);
                }}
              />
            </div>

            {/* Reserve space to avoid layout "stutter" on focus */}
            <div
              className={cn(
                'mt-1 h-4 flex items-center justify-between text-[11px] px-1',
                'text-zinc-500 dark:text-white/40',
                'transition-opacity duration-150',
                showMeta ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            >
              <span>Enter to send • Shift+Enter for newline</span>
              <span
                className={cn(
                  'tabular-nums transition-opacity duration-150',
                  showCounter ? 'opacity-100' : 'opacity-0',
                  isTooLong && 'text-red-600 dark:text-red-400 opacity-100'
                )}
              >
                {content.length}/{MAX_CHARS}
              </span>
            </div>

            {isTooLong && (
              <div className="mt-1 text-[11px] text-red-600 dark:text-red-400 px-1">
                Message is too long. Shorten it to send.
              </div>
            )}
          </div>

          <motion.button
            type="submit"
            disabled={isSending || !canSend || isTooLong}
            aria-disabled={isSending || !canSend || isTooLong}
            // Additive micro-interaction: the send button springs to brand accent
            // and scales up the moment a message becomes sendable, and presses in
            // on tap — so sending "feels alive".
            animate={{ scale: canSend && !isTooLong ? 1 : 0.92 }}
            whileTap={canSend && !isTooLong ? { scale: 0.85 } : undefined}
            transition={{ type: 'spring', stiffness: 600, damping: 22 }}
            className={cn(
              'shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors',
              canSend && !isTooLong && !isSending
                ? 'bg-sky-500 text-white dark:bg-emerald-500 dark:text-zinc-900 hover:bg-sky-600 dark:hover:bg-emerald-400'
                : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900',
              (isSending || !canSend || isTooLong) && 'opacity-50 cursor-not-allowed',
            )}
            aria-label={isEditing ? 'Save message' : 'Send message'}
            title={isEditing ? 'Save' : 'Send'}
          >
            {isSending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
            ) : (
              <FiArrowUp className="h-5 w-5" />
            )}
          </motion.button>

          {isEditing && (
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 h-10 rounded-full px-4"
              onClick={onCancelEdit}
              disabled={isSending}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </form>
  );
};