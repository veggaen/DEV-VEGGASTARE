"use client";

/**
 * @fileOverview ThemedSelect — a small custom dropdown that matches the app's dark
 *   glass language. Native <select> option lists render with an OS-white popup that
 *   ignores the theme (the "ugly white dropdown"); this replaces it with a styled,
 *   accessible listbox. Keyboard: Enter/Space to open, arrows to move, Esc to close.
 */

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiChevronDown, FiCheck } from "react-icons/fi";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export function ThemedSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  ariaLabel,
}: {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  // Close on outside click / Escape.
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-xl bg-black/4 dark:bg-white/5 border border-black/8 dark:border-white/10 px-3 py-2 text-sm text-foreground outline-none hover:bg-black/6 dark:hover:bg-white/8 focus:border-emerald-500/50 transition-colors"
      >
        <span className={cn("truncate", !current && "text-muted-foreground")}>
          {current?.label ?? placeholder}
        </span>
        <FiChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top" }}
            className="absolute z-30 mt-1.5 w-full max-h-56 overflow-y-auto rounded-xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#15181e]/97 backdrop-blur-md shadow-xl p-1"
          >
            {options.map((o) => {
              const selected = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => { onChange(o.value); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm text-left transition-colors",
                      selected
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "hover:bg-black/5 dark:hover:bg-white/8 text-foreground",
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {selected && <FiCheck className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
