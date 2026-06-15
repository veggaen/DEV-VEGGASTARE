/**
 * @fileOverview CopyChip — A compact inline button that copies text to
 * clipboard and shows an animated "Copied ✓" tooltip that fades away.
 *
 * Usage:
 *   <CopyChip text={email} label="Copy email" />
 *   <CopyChip text={address} label="Copy address" />
 *
 * @stability stable
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FiCopy, FiCheck } from "react-icons/fi";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";

interface CopyChipProps {
  /** The text to copy */
  text: string;
  /** Accessible label */
  label?: string;
  /** Size variant */
  size?: "xs" | "sm";
  /** Extra classes for the trigger button */
  className?: string;
}

export function CopyChip({
  text,
  label = "Copy",
  size = "xs",
  className,
}: CopyChipProps) {
  const { copied, copy } = useCopyFeedback();

  const iconSize = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";
  const padSize = size === "xs" ? "p-1" : "p-1.5";

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => copy(text)}
        className={`shrink-0 ${padSize} rounded-md transition-colors
          hover:bg-zinc-200 dark:hover:bg-zinc-700
          active:scale-95 ${className ?? ""}`}
        title={label}
        aria-label={label}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <FiCheck
                className={`${iconSize} text-sky-500 dark:text-emerald-500`}
              />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <FiCopy className={`${iconSize} text-zinc-400`} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Floating "Copied" tooltip */}
      <AnimatePresence>
        {copied && (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap
              rounded-md bg-zinc-900 dark:bg-zinc-100 px-2 py-0.5
              text-[10px] font-medium text-white dark:text-zinc-900
              shadow-lg pointer-events-none z-50"
          >
            Copied ✓
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
