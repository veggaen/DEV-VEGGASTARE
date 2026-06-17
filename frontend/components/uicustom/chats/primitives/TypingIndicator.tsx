'use client';

/**
 * @fileOverview Animated "typing…" indicator — three bouncing dots in a chat
 * bubble, matching the incoming-message bubble style. Shared across all chat
 * frames (DM, AI, landing widget, topbar dropdown) for a consistent feel.
 *
 * Purely additive: render it conditionally above the input or at the bottom of
 * the message list when a participant / the AI is composing.
 *
 * @stability experimental
 */
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  /** Optional label, e.g. "Alex is typing" or "Gemini is thinking". */
  label?: string;
  className?: string;
}

export function TypingIndicator({ label, className }: TypingIndicatorProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn('flex items-end gap-2', className)} aria-live="polite">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border/60 bg-muted px-3.5 py-3 shadow-sm">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-2 w-2 rounded-full bg-muted-foreground/60"
            animate={reduceMotion ? undefined : { y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }
            }
          />
        ))}
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}
