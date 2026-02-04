"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { FiBell } from "react-icons/fi";

interface NotificationBellProps {
  count?: number;
  hasUnread?: boolean;
  onClick?: () => void;
  isOpen?: boolean;
  className?: string;
}

export function NotificationBell({ 
  count = 0, 
  hasUnread = false,
  onClick,
  isOpen = false,
  className 
}: NotificationBellProps) {
  const displayCount = count > 99 ? "99+" : count;
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center",
        "h-9 w-9 rounded-lg",
        "text-zinc-500 dark:text-zinc-400",
        "hover:bg-zinc-100 dark:hover:bg-zinc-800",
        "hover:text-zinc-900 dark:hover:text-zinc-100",
        "transition-colors",
        isOpen && "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100",
        className
      )}
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
    >
      {/* Bell icon with shake animation - key changes when count changes to retrigger */}
      <motion.div
        key={`bell-${count}`}
        initial={{ rotate: 0 }}
        animate={{
          rotate: [0, -15, 15, -10, 10, -5, 5, 0],
        }}
        transition={{
          duration: 0.6,
          ease: "easeInOut"
        }}
      >
        <FiBell className="h-[18px] w-[18px]" />
      </motion.div>
      
      {/* Notification badge */}
      <AnimatePresence>
        {(hasUnread || count > 0) && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={cn(
              "absolute -top-0.5 -right-0.5",
              "flex items-center justify-center",
              "min-w-4 h-4 px-1",
              "rounded-full",
              "bg-emerald-500 text-white",
              "text-[10px] font-bold"
            )}
          >
            {count > 0 ? displayCount : ""}
            
            {/* Pulse ring for unread notifications */}
            {hasUnread && (
              <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

// Mini variant for mobile or compact layouts
interface NotificationBellMiniProps {
  count?: number;
  hasUnread?: boolean;
  onClick?: () => void;
  className?: string;
}

export function NotificationBellMini({ 
  count = 0, 
  hasUnread = false,
  onClick,
  className 
}: NotificationBellMiniProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center",
        "h-8 w-8 rounded-full",
        "text-zinc-500 dark:text-zinc-400",
        "hover:bg-zinc-100 dark:hover:bg-zinc-800",
        "hover:text-zinc-900 dark:hover:text-zinc-100",
        "transition-colors",
        className
      )}
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
    >
      <FiBell className="h-4 w-4" />
      
      {/* Simple dot indicator */}
      {hasUnread && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500">
          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
        </span>
      )}
    </button>
  );
}
