import useSWR from "swr";
import { useCallback } from "react";
import { createLogger } from "@/lib/logger";
import { notificationRequest as fetcher } from "./use-notification-inbox";
export { useNotificationInbox as useNotifications } from "./use-notification-inbox";
const log = createLogger('Notifications');

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
        log.error('Failed to update notification settings', error);
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
