"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { notificationTypes } from "@/lib/pulse-labels";
import { StatusDot } from "./status-dot";
import { 
  type Notification, 
  type NotificationGroup, 
  getTimeAgo, 
  formatNotificationMessage 
} from "./types";
import { FaUser } from "react-icons/fa";
import { motion } from "framer-motion";
import Image from "next/image";

interface NotificationItemProps {
  notification: Notification;
  onClick?: () => void;
  onMarkRead?: () => void;
  compact?: boolean;
  className?: string;
}

export function NotificationItem({ 
  notification, 
  onClick, 
  onMarkRead,
  compact = false,
  className 
}: NotificationItemProps) {
  const config = notificationTypes[notification.type];
  if (!config) return null;
  
  const handleClick = () => {
    if (!notification.isRead && onMarkRead) {
      onMarkRead();
    }
    onClick?.();
  };
  
  return (
    <motion.button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full text-left relative group",
        "px-4 py-3 flex gap-3",
        "hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors",
        !notification.isRead && "bg-zinc-50/50 dark:bg-zinc-900/30",
        className
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
    >
      {/* Unread indicator */}
      {!notification.isRead && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
      )}
      
      {/* Actor avatar or type icon */}
      <div className="relative shrink-0">
        {notification.actor ? (
          <div className="relative">
            <Avatar className={cn("border border-zinc-200 dark:border-zinc-700", compact ? "h-9 w-9" : "h-10 w-10")}>
              <AvatarImage 
                src={notification.actor.image || "/users/avatar.webp"} 
                alt={notification.actor.name} 
              />
              <AvatarFallback className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs">
                <FaUser className="h-3.5 w-3.5" />
              </AvatarFallback>
            </Avatar>
            {notification.actor.status && (
              <span className="absolute -bottom-0.5 -right-0.5">
                <StatusDot status={notification.actor.status} size="xs" />
              </span>
            )}
            {/* Type indicator badge */}
            <span 
              className={cn(
                "absolute -bottom-1 -right-1 flex items-center justify-center",
                "w-5 h-5 rounded-full text-[10px]",
                "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700",
                "shadow-sm"
              )}
              style={{ color: config.color }}
            >
              {config.emoji}
            </span>
          </div>
        ) : (
          <div 
            className={cn(
              "flex items-center justify-center rounded-full",
              "bg-zinc-100 dark:bg-zinc-800",
              compact ? "h-9 w-9" : "h-10 w-10"
            )}
            style={{ color: config.color }}
          >
            <span className="text-lg">{config.emoji}</span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-zinc-900 dark:text-zinc-100 leading-snug",
          compact ? "text-sm" : "text-sm"
        )}>
          {notification.message}
        </p>
        
        {/* Preview text (for messages, replies, etc.) */}
        {notification.preview && !compact && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
            &ldquo;{notification.preview}&rdquo;
          </p>
        )}
        
        {/* Time and status */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {getTimeAgo(notification.createdAt)}
          </span>
          
          {notification.groupCount > 1 && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                +{notification.groupCount - 1} more
              </span>
            </>
          )}
        </div>
      </div>
      
      {/* Optional image preview */}
      {notification.imageUrl && !compact && (
        <div className="shrink-0 relative w-12 h-12">
          <Image 
            src={notification.imageUrl} 
            alt="" 
            fill
            className="rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
          />
        </div>
      )}
    </motion.button>
  );
}

// Grouped notification item for condensed view
interface GroupedNotificationItemProps {
  group: NotificationGroup;
  onClick?: () => void;
  className?: string;
}

export function GroupedNotificationItem({ 
  group, 
  onClick,
  className 
}: GroupedNotificationItemProps) {
  const config = notificationTypes[group.type];
  if (!config) return null;
  
  const message = formatNotificationMessage(
    group.type,
    group.actors,
    group.totalCount
  );
  
  const hasUnread = group.notifications.some(n => !n.isRead);
  
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left relative group",
        "px-4 py-3 flex gap-3",
        "hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors",
        hasUnread && "bg-zinc-50/50 dark:bg-zinc-900/30",
        className
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
    >
      {/* Unread indicator */}
      {hasUnread && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
      )}
      
      {/* Stacked avatars */}
      <div className="relative shrink-0 w-10 h-10">
        {group.actors.slice(0, 3).map((actor, i) => (
          <Avatar 
            key={actor.id}
            className={cn(
              "absolute border-2 border-white dark:border-zinc-950",
              "h-7 w-7",
              i === 0 && "top-0 left-0 z-30",
              i === 1 && "top-1 left-2.5 z-20",
              i === 2 && "top-2 left-5 z-10"
            )}
          >
            <AvatarImage src={actor.image || "/users/avatar.webp"} alt={actor.name} />
            <AvatarFallback className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[10px]">
              <FaUser className="h-2.5 w-2.5" />
            </AvatarFallback>
          </Avatar>
        ))}
        
        {/* Type indicator */}
        <span 
          className={cn(
            "absolute bottom-0 right-0 flex items-center justify-center z-40",
            "w-5 h-5 rounded-full text-[10px]",
            "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700",
            "shadow-sm"
          )}
          style={{ color: config.color }}
        >
          {config.emoji}
        </span>
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-900 dark:text-zinc-100 leading-snug">
          {message}
        </p>
        
        {/* Time */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {getTimeAgo(group.latestAt)}
          </span>
          <span className="text-zinc-300 dark:text-zinc-600">·</span>
          <span 
            className="text-xs font-medium"
            style={{ color: config.color }}
          >
            {group.totalCount} {config.title.toLowerCase()}
          </span>
        </div>
      </div>
    </motion.button>
  );
}
