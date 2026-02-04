"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationBell } from "./notification-bell";
import { NotificationItem, GroupedNotificationItem } from "./notification-item";
import { 
  type Notification, 
  type NotificationGroup,
  groupNotifications 
} from "./types";
import { notificationCategories } from "@/lib/pulse-labels";
import { FiSettings, FiCheck, FiInbox, FiArchive } from "react-icons/fi";
import Link from "next/link";

interface NotificationDropdownProps {
  notifications: Notification[];
  unreadCount?: number;
  isLoading?: boolean;
  onMarkAllRead?: () => void;
  onMarkRead?: (id: string) => void;
  onNotificationClick?: (notification: Notification) => void;
  onOpenSettings?: () => void;
  condensed?: boolean;
  className?: string;
}

export function NotificationDropdown({
  notifications,
  unreadCount = 0,
  isLoading = false,
  onMarkAllRead,
  onMarkRead,
  onNotificationClick,
  onOpenSettings,
  condensed = true,
  className
}: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // 8px gap
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);
  
  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);
  
  // Filter notifications based on tab
  const filteredNotifications = activeTab === "unread" 
    ? notifications.filter(n => !n.isRead)
    : notifications;
  
  // Group notifications if condensed mode is enabled
  const displayItems = condensed 
    ? groupNotifications(filteredNotifications)
    : filteredNotifications;
  
  const handleNotificationClick = useCallback((notification: Notification) => {
    onNotificationClick?.(notification);
    setIsOpen(false);
  }, [onNotificationClick]);
  
  // Dropdown content (rendered via portal)
  const dropdownContent = (
    <AnimatePresence>
      {isOpen && mounted && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            right: dropdownPosition.right,
            zIndex: 9999,
          }}
          className={cn(
            "w-[380px] max-w-[calc(100vw-32px)]",
            "rounded-xl",
            "bg-white dark:bg-zinc-950",
            "border border-zinc-200 dark:border-zinc-800",
            "shadow-xl shadow-zinc-900/10 dark:shadow-black/30",
            "overflow-hidden"
          )}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Notifications
                </h3>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    >
                      <FiCheck className="h-3.5 w-3.5" />
                      Mark all read
                    </button>
                  )}
                  <Link
                    href="/settings#notifications"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center h-8 w-8 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    title="Notification settings"
                  >
                    <FiSettings className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-1 mt-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                    activeTab === "all"
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <FiInbox className="h-3.5 w-3.5" />
                    All
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("unread")}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                    activeTab === "unread"
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    Unread
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </span>
                </button>
              </div>
            </div>
            
            {/* Notification list */}
            <div className="max-h-[400px] overflow-y-auto overscroll-contain">
              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <div className="h-6 w-6 border-2 border-zinc-200 dark:border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    Loading notifications...
                  </p>
                </div>
              ) : displayItems.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <FiInbox className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {activeTab === "unread" ? "All caught up!" : "No notifications yet"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {activeTab === "unread" 
                      ? "You've read all your notifications"
                      : "Your heartbeats and vibes will appear here"
                    }
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  <AnimatePresence>
                    {condensed ? (
                      // Grouped view
                      (displayItems as NotificationGroup[]).map((group) => (
                        <GroupedNotificationItem
                          key={group.key}
                          group={group}
                          onClick={() => {
                            if (group.notifications[0]) {
                              handleNotificationClick(group.notifications[0]);
                            }
                          }}
                        />
                      ))
                    ) : (
                      // Individual view
                      (displayItems as Notification[]).map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onClick={() => handleNotificationClick(notification)}
                          onMarkRead={() => onMarkRead?.(notification.id)}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
            
            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <Link
                  href="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="block text-center text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                >
                  View all notifications
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
  );
  
  return (
    <div ref={triggerRef} className={cn("relative", className)}>
      <NotificationBell
        count={unreadCount}
        hasUnread={unreadCount > 0}
        onClick={() => setIsOpen(!isOpen)}
        isOpen={isOpen}
      />
      
      {/* Render dropdown in portal to escape overflow:hidden containers */}
      {mounted && createPortal(dropdownContent, document.body)}
    </div>
  );
}
