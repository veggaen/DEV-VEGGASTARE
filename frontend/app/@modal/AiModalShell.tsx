"use client";

import { useRouter } from "next/navigation";
import { useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface AiModalShellProps {
  children: React.ReactNode;
}

/**
 * Modal overlay wrapper for AI chat parallel routes.
 * Click backdrop or press Escape to close (navigate back).
 */
export default function AiModalShell({ children }: AiModalShellProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const close = useCallback(() => router.back(), [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        key="ai-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6"
        aria-modal="true"
        role="dialog"
        aria-label="AI Chat"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={close}
          aria-hidden="true"
        />

        {/* Panel */}
        <motion.div
          key="ai-modal-panel"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 40, scale: reduceMotion ? 1 : 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : 40, scale: reduceMotion ? 1 : 0.97 }}
          transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative z-10 w-full md:max-w-5xl md:h-[80vh] h-[92dvh] glass-panel rounded-t-2xl md:rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
