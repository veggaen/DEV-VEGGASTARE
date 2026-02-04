import useSWR from "swr";
import { useCallback } from "react";
import type { Notification, NotificationGroup } from "@/components/uicustom/notifications/types";
import { groupNotifications } from "@/components/uicustom/notifications/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UseNotificationsOptions {
  limit?: number;
  unreadOnly?: boolean;
  refreshInterval?: number;
}

interface NotificationsResponse {
  notifications: Notification[];
  nextCursor: string | null;
  unreadCount: number;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { limit = 50, unreadOnly = false, refreshInterval = 30000 } = options;

  const queryParams = new URLSearchParams();
  if (limit) queryParams.set("limit", String(limit));
  if (unreadOnly) queryParams.set("unread", "true");

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<NotificationsResponse>(
    `/api/notifications?${queryParams.toString()}`,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const markAsRead = useCallback(
    async (id: string) => {
      // Optimistic update
      mutate(
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            notifications: prev.notifications.map((n) =>
              n.id === id ? { ...n, isRead: true, readAt: new Date() } : n
            ),
            unreadCount: Math.max(0, prev.unreadCount - 1),
          };
        },
        false
      );

      try {
        await fetch(`/api/notifications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        });
        mutate();
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
        mutate();
      }
    },
    [mutate]
  );

  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    mutate(
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notifications: prev.notifications.map((n) => ({
            ...n,
            isRead: true,
            readAt: new Date(),
          })),
          unreadCount: 0,
        };
      },
      false
    );

    try {
      await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });
      mutate();
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      mutate();
    }
  }, [mutate]);

  const archiveNotification = useCallback(
    async (id: string) => {
      // Optimistic update
      mutate(
        (prev) => {
          if (!prev) return prev;
          const notification = prev.notifications.find((n) => n.id === id);
          return {
            ...prev,
            notifications: prev.notifications.filter((n) => n.id !== id),
            unreadCount: notification?.isRead
              ? prev.unreadCount
              : Math.max(0, prev.unreadCount - 1),
          };
        },
        false
      );

      try {
        await fetch(`/api/notifications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isArchived: true }),
        });
        mutate();
      } catch (error) {
        console.error("Failed to archive notification:", error);
        mutate();
      }
    },
    [mutate]
  );

  const deleteNotification = useCallback(
    async (id: string) => {
      // Optimistic update
      mutate(
        (prev) => {
          if (!prev) return prev;
          const notification = prev.notifications.find((n) => n.id === id);
          return {
            ...prev,
            notifications: prev.notifications.filter((n) => n.id !== id),
            unreadCount: notification?.isRead
              ? prev.unreadCount
              : Math.max(0, prev.unreadCount - 1),
          };
        },
        false
      );

      try {
        await fetch(`/api/notifications/${id}`, {
          method: "DELETE",
        });
        mutate();
      } catch (error) {
        console.error("Failed to delete notification:", error);
        mutate();
      }
    },
    [mutate]
  );

  // Group notifications for condensed view
  const groupedNotifications: NotificationGroup[] = data?.notifications
    ? groupNotifications(data.notifications)
    : [];

  return {
    notifications: data?.notifications || [],
    groupedNotifications,
    unreadCount: data?.unreadCount || 0,
    nextCursor: data?.nextCursor,
    isLoading,
    isError: !!error,
    error,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    refresh: mutate,
  };
}

// Hook for notification settings
interface NotificationSettingsData {
  heartbeatEnabled: boolean;
  vibeEnabled: boolean;
  repulseEnabled: boolean;
  replyEnabled: boolean;
  syncEnabled: boolean;
  dmEnabled: boolean;
  groupMessageEnabled: boolean;
  mentionEnabled: boolean;
  hotPulseEnabled: boolean;
  milestoneEnabled: boolean;
  vibeCheckEnabled: boolean;
  pushEnabled: boolean;
  emailDigestEnabled: boolean;
  inAppEnabled: boolean;
  condenseNotifications: boolean;
  condenseThreshold: number;
  showPreviews: boolean;
  showTypingIndicators: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export function useNotificationSettings() {
  const { data, error, isLoading, mutate } = useSWR<NotificationSettingsData>(
    "/api/notifications/settings",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  const updateSettings = useCallback(
    async (updates: Partial<NotificationSettingsData>) => {
      // Optimistic update
      mutate((prev) => (prev ? { ...prev, ...updates } : prev), false);

      try {
        const res = await fetch("/api/notifications/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!res.ok) throw new Error("Failed to update settings");
        mutate();
      } catch (error) {
        console.error("Failed to update notification settings:", error);
        mutate();
        throw error;
      }
    },
    [mutate]
  );

  return {
    settings: data,
    isLoading,
    isError: !!error,
    error,
    updateSettings,
    refresh: mutate,
  };
}
