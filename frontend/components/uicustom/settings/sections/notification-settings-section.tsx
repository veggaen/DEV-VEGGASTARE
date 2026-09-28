"use client";

/** @fileOverview Settings › Notifications: loads the user's preferences and mutes, saves each change optimistically. @stability evolving */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiBell } from "react-icons/fi";
import { NotificationSettings as NotificationSettingsComponent } from "@/components/uicustom/notifications/notification-settings";
import type { NotificationMute, NotificationSettings as NotificationSettingsType } from "@/components/uicustom/notifications/types";
import { SectionHeader } from "../settings-primitives";

const DEFAULTS: NotificationSettingsType = {
  id: "", userId: "",
  heartbeatEnabled: true, vibeEnabled: true, repulseEnabled: true, replyEnabled: true, syncEnabled: true, dmEnabled: true, groupMessageEnabled: true, mentionEnabled: true,
  hotPulseEnabled: true, milestoneEnabled: true, vibeCheckEnabled: false,
  pushEnabled: true, emailDigestEnabled: false, inAppEnabled: true,
  condenseNotifications: true, condenseThreshold: 5, showPreviews: true, showTypingIndicators: true,
  quietHoursEnabled: false, quietHoursStart: "22:00", quietHoursEnd: "08:00",
  createdAt: new Date(), updatedAt: new Date(),
};

export function NotificationSettingsSection() {
  const [settings, setSettings] = useState<NotificationSettingsType>(DEFAULTS);
  const [mutes, setMutes] = useState<NotificationMute[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications/settings")
      .then((res) => res.json())
      .then((data) => { if (data && !data.error) setSettings((prev) => ({ ...prev, ...data })); })
      .catch((err) => console.error("Failed to fetch notification settings:", err))
      .finally(() => setIsLoading(false));
    fetch("/api/notifications/mutes")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setMutes(data); })
      .catch((err) => console.error("Failed to fetch mutes:", err));
  }, []);

  const handleSettingsChange = async (changes: Partial<NotificationSettingsType>) => {
    setSettings((prev) => ({ ...prev, ...changes }));
    try {
      const res = await fetch("/api/notifications/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      if (!res.ok) toast.error("Failed to update notification settings");
      else toast.success("Notification settings updated");
    } catch {
      toast.error("Failed to update notification settings");
    }
  };

  const handleRemoveMute = async (muteId: string) => {
    setMutes((prev) => prev.filter((m) => m.id !== muteId));
    try {
      const res = await fetch(`/api/notifications/mutes/${muteId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to remove mute");
        const data = await fetch("/api/notifications/mutes").then((r) => r.json());
        if (Array.isArray(data)) setMutes(data);
      } else toast.success("Mute removed");
    } catch {
      toast.error("Failed to remove mute");
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader icon={FiBell} title="Notifications" description="Choose what reaches you, where, and when." />
      <NotificationSettingsComponent settings={settings} mutes={mutes} onSettingsChange={handleSettingsChange} onRemoveMute={handleRemoveMute} isLoading={isLoading} />
    </div>
  );
}
