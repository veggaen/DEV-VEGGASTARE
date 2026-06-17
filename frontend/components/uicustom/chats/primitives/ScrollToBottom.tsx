'use client';

/**
 * @fileOverview Floating "scroll to latest" button for chat frames. Appears with
 * a spring pop when the user has scrolled up away from the bottom (so new
 * messages don't yank them down), and optionally shows an unread-count badge.
 * Shared across all chat frames. Purely additive.
 *
 * Usage: give it the scroll container ref; it self-manages visibility.
 *
 * @stability experimental
 */
import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiChevronDown } from 'react-icons/fi';
import { cn } from '@/lib/utils';

interface ScrollToBottomProps {
  /** The scrollable message container. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Show this many unread as a badge (optional). */
  unreadCount?: number;
  /** px from bottom before we consider the user "scrolled up". */
  threshold?: number;
  className?: string;
}

export function ScrollToBottom({
  containerRef,
  unreadCount = 0,
  threshold = 120,
  className,
}: ScrollToBottomProps) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setVisible(distance > threshold);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [containerRef, threshold]);

  const scrollDown = () => {
    const el = containerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={scrollDown}
          initial={{ opacity: 0, scale: 0.7, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 8 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          className={cn(
            'absolute bottom-4 right-4 z-20 inline-flex h-10 w-10 items-center justify-center',
            'rounded-full border border-border bg-card/90 text-foreground shadow-lg backdrop-blur',
            'hover:bg-muted transition-colors',
            className,
          )}
          aria-label="Scroll to latest messages"
        >
          <FiChevronDown className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white dark:bg-emerald-500">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
