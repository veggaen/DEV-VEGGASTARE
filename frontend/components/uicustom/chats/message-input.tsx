'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useEdgeStore } from '@/lib/edgestore';
import { RxCrossCircled } from "react-icons/rx";
import { FaFileUpload } from "react-icons/fa";
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FiAlertTriangle, FiArrowUp, FiSmile, FiMic } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpeechToText } from './primitives/useSpeechToText';

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

interface DictationCorrection {
  from: string;
  to: string;
}

const DICTATION_CORRECTIONS_KEY = 'voice:dictation-corrections';

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
  const lastContentRef = useRef(initialContent);
  const recentDictationUntilRef = useRef(0);
  const [pendingCorrection, setPendingCorrection] = useState<DictationCorrection | null>(null);

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

  // Speech-to-text (Whisper-Flow style). Finalized phrases are appended to the
  // content with sensible spacing; interim text shows as a live caption.
  const appendDictation = (chunk: string) => {
    setContent((c) => {
      const sep = c && !/\s$/.test(c) ? ' ' : '';
      const next = (c + sep + chunk).slice(0, MAX_CHARS);
      lastContentRef.current = next;
      recentDictationUntilRef.current = Date.now() + 45000;
      return next;
    });
    requestAnimationFrame(resizeTextarea);
  };

  const handleContentChange = (next: string) => {
    const previous = lastContentRef.current;
    if (Date.now() < recentDictationUntilRef.current) {
      const correction = inferDictationCorrection(previous, next);
      if (correction) setPendingCorrection(correction);
    }
    lastContentRef.current = next;
    setContent(next);
  };

  const savePendingCorrection = async () => {
    if (!pendingCorrection) return;
    saveDictationCorrection(pendingCorrection);
    setPendingCorrection(null);
    const { toast } = await import('sonner');
    toast.success('Saved to your voice dictionary.');
  };
  const [dictated, setDictated] = useState(false);
  const {
    supported: micSupported,
    listening,
    requesting: dictationRequesting,
    interim,
    error: dictationError,
    toggle: toggleMic,
  } = useSpeechToText({
    onResult: (chunk) => {
      appendDictation(chunk);
      setDictated(true);
    },
  });

  // Wispr-style polish: clean up the dictated text (fillers, self-corrections,
  // punctuation) via the AI. Replaces the field with the polished result; the
  // user can still edit before sending. Best-effort — failures keep the raw text.
  const [polishing, setPolishing] = useState(false);
  const handlePolish = async () => {
    const text = content.trim();
    if (!text || polishing) return;
    setPolishing(true);
    try {
      const correctionContext = readDictationCorrections()
        .slice(0, 8)
        .map((entry) => `If speech-to-text produced "${entry.from}", the user often means "${entry.to}".`);
      const res = await fetch('/api/voice/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: text, context: correctionContext }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.ok && data.text) {
          lastContentRef.current = data.text.slice(0, MAX_CHARS);
          setContent(data.text.slice(0, MAX_CHARS));
          setDictated(false);
          requestAnimationFrame(() => {
            resizeTextarea();
            textareaRef.current?.focus();
          });
        }
      }
    } catch {
      // keep raw text
    } finally {
      setPolishing(false);
    }
  };

  const canSend = useMemo(() => Boolean(content.trim()) || Boolean(imagePreview), [content, imagePreview]);
  const isTooLong = content.length > MAX_CHARS;
  const showMeta = isFocused || content.length > 0 || Boolean(imagePreview) || listening;
  const showCounter = isFocused || content.length > Math.floor(MAX_CHARS * 0.8) || isTooLong;

  // Draft persistence (text only). Skips edit mode.
  useEffect(() => {
    if (isEditing) return;
    if (typeof window === 'undefined') return;
    if (initialContent?.trim()) return;

    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved && !content) {
        lastContentRef.current = saved;
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
        lastContentRef.current = '';
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
      {/* Single composer surface — textarea on top, a thin toolbar below. No
          nested rounded boxes: the card itself is the only rounded surface, and
          the focus ring lives on it. */}
      <div
        {...getRootProps()}
        className={cn(
          'group/composer relative rounded-[22px] border bg-white/90 dark:bg-zinc-900/70 backdrop-blur-md',
          'border-zinc-200/80 dark:border-white/10',
          'shadow-sm transition-all duration-200',
          'focus-within:border-sky-400/60 dark:focus-within:border-emerald-400/40',
          'focus-within:shadow-[0_0_0_4px_rgba(56,189,248,0.10)] dark:focus-within:shadow-[0_0_0_4px_rgba(52,211,153,0.10)]',
          isTooLong && 'border-red-400/70 dark:border-red-500/50 focus-within:border-red-400/70',
        )}
      >
        <input {...getInputProps()} />

        {/* Image preview chip */}
        {imagePreview && (
          <div className="px-3 pt-3">
            <div className="relative inline-block">
              <Image
                src={imagePreview}
                alt="Selected image"
                width={96}
                height={96}
                unoptimized
                className="h-24 w-24 rounded-xl object-cover border border-black/10 dark:border-white/10"
              />
              <button
                type="button"
                className="absolute -top-2 -right-2 grid place-items-center h-6 w-6 rounded-full bg-zinc-900/90 text-white hover:bg-red-600 shadow-md transition-colors"
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
              className="absolute bottom-[calc(100%+8px)] left-2 z-20 flex flex-wrap gap-1 rounded-2xl border border-zinc-200/80 bg-white/95 p-2 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/95"
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

        {/* Textarea — flush in the surface, full width */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Write a message…"
          className={cn(
            'w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-relaxed',
            'text-zinc-900 dark:text-white',
            'placeholder:text-zinc-400 dark:placeholder:text-white/40 focus:outline-none',
            isTextareaScrollable ? 'overflow-y-auto' : 'overflow-y-hidden',
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

        <AnimatePresence>
          {(dictationRequesting || listening || interim || dictationError) && (
            <motion.div
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 6, height: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="overflow-hidden px-3"
            >
              <div
                className={cn(
                  'mb-1 flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs',
                  dictationError
                    ? 'border-red-500/20 bg-red-500/8 text-red-600 dark:text-red-300'
                    : 'border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300',
                )}
              >
                {dictationError ? (
                  <FiAlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <span className="relative grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15">
                    <FiMic className="h-3.5 w-3.5" />
                    <span className="absolute inset-0 rounded-full bg-emerald-400/25 animate-ping" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">
                  {dictationError ?? (dictationRequesting ? 'Opening microphone...' : interim ? `Hearing: ${interim}` : 'Listening. Speak naturally, then tap the mic to finish.')}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {pendingCorrection && !listening && (
            <motion.div
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 6, height: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="overflow-hidden px-3"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/8 px-3 py-2 text-xs text-sky-700 dark:text-sky-300">
                <span className="min-w-0 flex-1">
                  Did we mishear <span className="font-semibold">"{pendingCorrection.from}"</span> as <span className="font-semibold">"{pendingCorrection.to}"</span>?
                </span>
                <button
                  type="button"
                  onClick={savePendingCorrection}
                  className="rounded-full bg-sky-500/15 px-2.5 py-1 font-medium transition-colors hover:bg-sky-500/25"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setPendingCorrection(null)}
                  className="rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/8"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar row — ghost icon controls left, hint + counter center, send right */}
        <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1">
          <IconButton onClick={open} disabled={isSending} label="Attach image">
            <FaFileUpload className="h-4.5 w-4.5" />
          </IconButton>

          <IconButton
            onClick={() => setShowEmoji((s) => !s)}
            disabled={isSending}
            label="Emoji"
            active={showEmoji}
          >
            <FiSmile className="h-4.5 w-4.5" />
          </IconButton>

          {/* Speech-to-text — only shown where the browser supports it */}
          {micSupported && (
            <IconButton
              onClick={toggleMic}
              disabled={isSending || dictationRequesting}
              label={listening ? 'Stop dictation' : 'Dictate message'}
              active={listening}
            >
              {listening ? (
                <span className="relative grid place-items-center">
                  <FiMic className="h-4.5 w-4.5" />
                  {/* pulsing ring while recording */}
                  <span className="absolute inset-0 -m-1.5 rounded-full bg-red-500/20 animate-ping" />
                </span>
              ) : (
                <FiMic className="h-4.5 w-4.5" />
              )}
            </IconButton>
          )}

          {/* Wispr-style polish — appears after dictation, cleans the text up */}
          <AnimatePresence>
            {dictated && !listening && content.trim() && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                exit={{ opacity: 0, scale: 0.8, width: 0 }}
                onClick={handlePolish}
                disabled={polishing || isSending}
                className="shrink-0 inline-flex items-center gap-1 h-9 rounded-full px-3 text-xs font-medium text-sky-600 dark:text-emerald-400 bg-sky-500/10 dark:bg-emerald-400/10 hover:bg-sky-500/20 dark:hover:bg-emerald-400/20 transition-colors whitespace-nowrap overflow-hidden"
                title="Clean up dictated text"
              >
                {polishing ? (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <span className="text-sm leading-none">✨</span>
                )}
                {polishing ? 'Polishing…' : 'Polish'}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Hint + counter — fade in once the field is active */}
          <div
            className={cn(
              'ml-1 flex-1 min-w-0 flex items-center gap-2 text-[11px] text-zinc-400 dark:text-white/35 transition-opacity duration-150',
              showMeta ? 'opacity-100' : 'opacity-0',
            )}
          >
            <span className="hidden sm:inline truncate">
              {listening ? (
                <span className="inline-flex items-center gap-1.5 text-red-500 dark:text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  {interim ? <span className="text-foreground/70 italic">{interim}</span> : 'Listening…'}
                </span>
              ) : isTooLong ? (
                'Message is too long'
              ) : (
                'Enter to send · Shift+Enter for newline'
              )}
            </span>
            <span
              className={cn(
                'ml-auto shrink-0 tabular-nums transition-colors',
                showCounter ? 'opacity-100' : 'opacity-0',
                isTooLong && 'text-red-500 dark:text-red-400 font-medium opacity-100',
              )}
            >
              {content.length}/{MAX_CHARS}
            </span>
          </div>

          {isEditing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 h-9 rounded-full px-3 text-xs"
              onClick={onCancelEdit}
              disabled={isSending}
            >
              Cancel
            </Button>
          )}

          {/* Send — springs to brand accent the moment a message is sendable */}
          <motion.button
            type="submit"
            disabled={isSending || !canSend || isTooLong}
            aria-disabled={isSending || !canSend || isTooLong}
            animate={{ scale: canSend && !isTooLong ? 1 : 0.9 }}
            whileTap={canSend && !isTooLong ? { scale: 0.85 } : undefined}
            transition={{ type: 'spring', stiffness: 600, damping: 22 }}
            className={cn(
              'shrink-0 grid place-items-center h-9 w-9 rounded-full transition-colors',
              canSend && !isTooLong && !isSending
                ? 'bg-sky-500 text-white dark:bg-emerald-500 dark:text-zinc-900 hover:bg-sky-600 dark:hover:bg-emerald-400 shadow-md shadow-sky-500/25 dark:shadow-emerald-500/25'
                : 'bg-zinc-200 text-zinc-400 dark:bg-white/10 dark:text-white/30 cursor-not-allowed',
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
        </div>
      </div>
    </form>
  );
};

/** Ghost icon button for the composer toolbar — subtle until hovered/active. */
const IconButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}> = ({ onClick, disabled, label, active, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={cn(
      'shrink-0 grid place-items-center h-9 w-9 rounded-full transition-colors',
      'hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95 disabled:opacity-40',
      active
        ? 'text-sky-500 dark:text-emerald-400 bg-sky-500/10 dark:bg-emerald-400/10'
        : 'text-zinc-500 dark:text-white/55',
    )}
  >
    {children}
  </button>
);

function inferDictationCorrection(previous: string, next: string): DictationCorrection | null {
  if (!previous || !next || previous === next) return null;
  const delta = Math.abs(previous.length - next.length);
  if (delta > 80) return null;

  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++;

  let previousEnd = previous.length - 1;
  let nextEnd = next.length - 1;
  while (previousEnd >= start && nextEnd >= start && previous[previousEnd] === next[nextEnd]) {
    previousEnd--;
    nextEnd--;
  }

  const from = previous.slice(start, previousEnd + 1).trim();
  const to = next.slice(start, nextEnd + 1).trim();
  if (!from || !to || from === to) return null;
  if (from.length > 64 || to.length > 64) return null;
  if (from.split(/\s+/).length > 5 || to.split(/\s+/).length > 5) return null;

  return { from, to };
}

function readDictationCorrections(): DictationCorrection[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DICTATION_CORRECTIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is DictationCorrection =>
        typeof entry?.from === 'string' &&
        typeof entry?.to === 'string' &&
        entry.from.trim().length > 0 &&
        entry.to.trim().length > 0,
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

function saveDictationCorrection(correction: DictationCorrection) {
  if (typeof window === 'undefined') return;
  const normalized = {
    from: correction.from.trim(),
    to: correction.to.trim(),
  };
  if (!normalized.from || !normalized.to) return;

  const existing = readDictationCorrections().filter(
    (entry) => entry.from.toLowerCase() !== normalized.from.toLowerCase(),
  );
  window.localStorage.setItem(
    DICTATION_CORRECTIONS_KEY,
    JSON.stringify([normalized, ...existing].slice(0, 50)),
  );
}
