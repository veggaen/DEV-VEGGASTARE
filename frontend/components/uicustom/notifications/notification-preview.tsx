"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { notificationTypes } from "@/lib/pulse-labels";
import { StatusDot } from "./status-dot";
import type { NotificationTypeName, NotificationActor } from "./types";
import { FaUser } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

interface NotificationPreviewProps {
  type: NotificationTypeName;
  actor: NotificationActor;
  isTyping?: boolean;
  preview?: string;
  className?: string;
}

export function NotificationPreview({ 
  type, 
  actor, 
  isTyping = false,
  preview,
  className 
}: NotificationPreviewProps) {
  const config = notificationTypes[type];
  if (!config) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-xl",
        "bg-white dark:bg-zinc-900",
        "border border-zinc-200 dark:border-zinc-800",
        "shadow-lg shadow-zinc-900/5 dark:shadow-black/20",
        "p-4",
        className
      )}
    >
      {/* Animated gradient background for heartbeat effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: [0, 0.15, 0],
          scale: [1, 1.05, 1]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{
          background: `radial-gradient(circle at center, ${config.color}20 0%, transparent 70%)`
        }}
      />
      
      <div className="relative flex gap-3">
        {/* Actor avatar with status */}
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 border border-zinc-200 dark:border-zinc-700">
            <AvatarImage src={actor.image || "/users/avatar.webp"} alt={actor.name} />
            <AvatarFallback className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
              <FaUser className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          {actor.status && (
            <span className="absolute -bottom-0.5 -right-0.5">
              <StatusDot status={actor.status} size="sm" />
            </span>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
              {actor.name}
            </span>
            {actor.username && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                @{actor.username}
              </span>
            )}
          </div>
          
          {/* Typing indicator or preview */}
          <div className="mt-1">
            {isTyping ? (
              <div className="flex items-center gap-1.5">
                <span 
                  className="text-xs font-medium"
                  style={{ color: config.color }}
                >
                  {config.emoji}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {type === "HEARTBEAT" && "Heartbeat rising..."}
                  {type === "REPLY" && "Reply incoming..."}
                  {type === "DM" && "Message incoming..."}
                  {type === "VIBE" && "Catching your vibe..."}
                </span>
                <TypingDots color={config.color} />
              </div>
            ) : preview ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2">
                {preview}
              </p>
            ) : (
              <p 
                className="text-xs font-medium"
                style={{ color: config.color }}
              >
                {config.title}
              </p>
            )}
          </div>
        </div>
        
        {/* Type indicator */}
        <div 
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full"
          style={{ 
            backgroundColor: `${config.color}15`,
            color: config.color 
          }}
        >
          <HeartbeatIcon type={type} color={config.color} />
        </div>
      </div>
    </motion.div>
  );
}

// Typing indicator dots with animation
function TypingDots({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full"
          style={{ backgroundColor: color }}
          animate={{ 
            opacity: [0.3, 1, 0.3],
            scale: [0.8, 1, 0.8]
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
}

// Animated icon based on notification type
function HeartbeatIcon({ type, color }: { type: NotificationTypeName; color: string }) {
  const config = notificationTypes[type];
  
  // Heartbeat pulse animation for engagement types
  const shouldPulse = ["HEARTBEAT", "VIBE", "HOT_PULSE"].includes(type);
  
  return (
    <motion.span
      className="text-base"
      animate={shouldPulse ? {
        scale: [1, 1.2, 1],
      } : {}}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {config?.emoji || "💫"}
    </motion.span>
  );
}

// Toast-style notification preview for real-time notifications
interface NotificationToastProps {
  type: NotificationTypeName;
  actor: NotificationActor;
  message: string;
  preview?: string;
  onClose?: () => void;
  onClick?: () => void;
  duration?: number;
}

export function NotificationToast({
  type,
  actor,
  message,
  preview,
  onClose,
  onClick,
  duration = 5000
}: NotificationToastProps) {
  const config = notificationTypes[type];
  if (!config) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-2xl",
        "bg-white dark:bg-zinc-900",
        "border border-zinc-200 dark:border-zinc-800",
        "shadow-xl shadow-zinc-900/10 dark:shadow-black/30",
        "max-w-sm w-full"
      )}
      onClick={onClick}
    >
      {/* Progress bar */}
      <motion.div
        className="absolute top-0 left-0 h-0.5"
        style={{ backgroundColor: config.color }}
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: duration / 1000, ease: "linear" }}
        onAnimationComplete={onClose}
      />
      
      {/* Heartbeat glow effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          opacity: [0, 0.2, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: 3,
          ease: "easeInOut"
        }}
        style={{
          background: `radial-gradient(circle at 20% 50%, ${config.color}30 0%, transparent 50%)`
        }}
      />
      
      <div className="relative p-4 flex gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 border border-zinc-200 dark:border-zinc-700">
            <AvatarImage src={actor.image || "/users/avatar.webp"} alt={actor.name} />
            <AvatarFallback className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
              <FaUser className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <span 
            className={cn(
              "absolute -bottom-1 -right-1 flex items-center justify-center",
              "w-5 h-5 rounded-full text-[10px]",
              "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
            )}
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: 2 }}
            >
              {config.emoji}
            </motion.span>
          </span>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {message}
          </p>
          {preview && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
              &ldquo;{preview}&rdquo;
            </p>
          )}
        </div>
        
        {/* Close button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          className="shrink-0 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
