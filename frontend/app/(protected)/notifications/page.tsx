"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationItem, GroupedNotificationItem } from "@/components/uicustom/notifications/notification-item";
import { 
  type Notification, 
  type NotificationGroup,
  groupNotifications 
} from "@/components/uicustom/notifications/types";
import { 
  FiSettings, 
  FiCheck, 
  FiCheckCircle,
  FiInbox, 
  FiArchive, 
  FiBell,
  FiFilter,
  FiTrash2,
  FiRefreshCw,
  FiChevronLeft
} from "react-icons/fi";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TabType = "all" | "unread" | "archived";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (activeTab === "unread") params.set("unreadOnly", "true");
      if (activeTab === "archived") params.set("archived", "true");
      
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark notification as read
  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date() } : n)
      );
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      setNotifications(prev => 
        prev.map(n => ({ ...n, isRead: true, readAt: new Date() }))
      );
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    if (notification.pulseId) {
      router.push(`/pulse/${notification.pulseId}`);
    } else if (notification.conversationId) {
      router.push(`/messages/${notification.conversationId}`);
    }
  };

  // Filter notifications (simplified - no category filter for now)
  const filteredNotifications = notifications;

  // Group notifications for condensed view
  const groupedNotifications = groupNotifications(filteredNotifications);
  
  // Unread count
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => router.back()}
              className="h-9 w-9"
            >
              <FiChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FiBell className="h-6 w-6 text-emerald-500" />
                Notifications
              </h1>
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchNotifications(true)}
                disabled={isRefreshing}
                className="h-9 w-9"
              >
                <FiRefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
              <Link href="/settings?section=notifications">
                <Button variant="outline" size="sm" className="gap-2">
                  <FiSettings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
            {[
              { id: "all" as TabType, label: "All", icon: FiInbox },
              { id: "unread" as TabType, label: "Unread", icon: FiBell },
              { id: "archived" as TabType, label: "Archived", icon: FiArchive },
            ].map(tab => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "gap-1.5",
                  activeTab === tab.id && "bg-background shadow-sm"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.id === "unread" && unreadCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-emerald-500 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Actions Bar */}
        {filteredNotifications.length > 0 && (
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <FiFilter className="h-4 w-4" />
                Filter
              </Button>
            </div>
            {unreadCount > 0 && activeTab !== "archived" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
              >
                <FiCheckCircle className="h-4 w-4" />
                Mark all as read
              </Button>
            )}
          </div>
        )}

        {/* Notifications List */}
        <div className="space-y-1">
          {isLoading ? (
            // Loading skeleton
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i}
                  className="h-20 rounded-xl bg-muted/50 animate-pulse"
                />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            // Empty state
            <div className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                {activeTab === "archived" ? (
                  <FiArchive className="h-8 w-8 text-muted-foreground" />
                ) : activeTab === "unread" ? (
                  <FiCheckCircle className="h-8 w-8 text-emerald-500" />
                ) : (
                  <FiBell className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-1">
                {activeTab === "archived" 
                  ? "No archived notifications"
                  : activeTab === "unread"
                  ? "All caught up!"
                  : "No notifications yet"
                }
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {activeTab === "archived"
                  ? "Notifications you archive will appear here"
                  : activeTab === "unread"
                  ? "You've read all your notifications"
                  : "When you get notifications, they'll show up here"
                }
              </p>
            </div>
          ) : (
            // Notifications list
            <AnimatePresence mode="popLayout">
              {groupedNotifications.map((group, index) => (
                <motion.div
                  key={group.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.03 }}
                >
                  {group.notifications.length > 1 ? (
                    <GroupedNotificationItem
                      group={group}
                      onClick={() => handleNotificationClick(group.notifications[0])}
                    />
                  ) : (
                    <NotificationItem
                      notification={group.notifications[0]}
                      onClick={() => handleNotificationClick(group.notifications[0])}
                      onMarkRead={() => markAsRead(group.notifications[0].id)}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Load More */}
        {filteredNotifications.length >= 100 && (
          <div className="mt-6 text-center">
            <Button variant="outline" size="sm">
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
