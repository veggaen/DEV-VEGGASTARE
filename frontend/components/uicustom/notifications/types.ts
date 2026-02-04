// Notification system types for the thematic Pulse/Heartbeat/Vibe/Ripple/Sync notification system

import { notificationTypes, presenceStatuses } from "@/lib/pulse-labels";

export type NotificationTypeName = keyof typeof notificationTypes;
export type PresenceStatusName = keyof typeof presenceStatuses;

export interface NotificationActor {
  id: string;
  name: string;
  username?: string;
  image?: string | null;
  status?: PresenceStatusName;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationTypeName;
  title: string;
  message: string;
  emoji?: string;
  preview?: string | null;
  imageUrl?: string | null;
  actorId?: string | null;
  actor?: NotificationActor | null;
  conversationId?: string | null;
  messageId?: string | null;
  pulseId?: string | null;
  isRead: boolean;
  isArchived: boolean;
  readAt?: Date | null;
  groupKey?: string | null;
  groupCount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | null;
}

export interface NotificationGroup {
  key: string;
  type: NotificationTypeName;
  notifications: Notification[];
  latestAt: Date;
  totalCount: number;
  actors: NotificationActor[];
  preview: string;
}

export interface NotificationSettings {
  id: string;
  userId: string;
  
  // Per-type toggles
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
  
  // Delivery channels
  pushEnabled: boolean;
  emailDigestEnabled: boolean;
  inAppEnabled: boolean;
  
  // Smart features
  condenseNotifications: boolean;
  condenseThreshold: number;
  showPreviews: boolean;
  showTypingIndicators: boolean;
  
  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export type MuteType = "USER" | "CONVERSATION" | "COMPANY";

export interface NotificationMute {
  id: string;
  userId: string;
  muteType: MuteType;
  targetId: string;
  targetName?: string;
  reason?: string;
  expiresAt?: Date | null;
  createdAt: Date;
}

export interface UserPresence {
  id: string;
  userId: string;
  status: PresenceStatusName;
  customStatus?: string | null;
  lastSeen: Date;
  currentActivity?: string | null;
}

// Helper function to get notification config
export function getNotificationConfig(type: NotificationTypeName) {
  return notificationTypes[type];
}

// Helper function to get presence config
export function getPresenceConfig(status: PresenceStatusName) {
  return presenceStatuses[status];
}

// Format notification message with actor names
export function formatNotificationMessage(
  type: NotificationTypeName,
  actors: NotificationActor[],
  count: number,
  targetName?: string
): string {
  const config = notificationTypes[type] as Record<string, unknown>;
  if (!config) return "You have a new notification";
  
  const actorName = actors[0]?.name || "Someone";
  const username = actors[0]?.username ? `@${actors[0].username}` : actorName;
  const title = (config.title as string) || type.toLowerCase();
  
  // Helper to get first available message template
  const getSingleMessage = (): string => {
    if (typeof config.single === 'string') return config.single;
    if (typeof config.alert === 'string') return config.alert;
    if (typeof config.prompt === 'string') return config.prompt;
    if (typeof config.syncs === 'string') return config.syncs;
    return `New ${title} from {user}`;
  };
  
  const getMultipleMessage = (): string => {
    if (typeof config.multiple === 'string') return config.multiple;
    if (typeof config.trending === 'string') return config.trending;
    if (typeof config.pulses === 'string') return config.pulses;
    return `{count} new ${title}`;
  };
  
  const getGroupedMessage = (): string => {
    if (typeof config.grouped === 'string') return config.grouped;
    if (typeof config.viral === 'string') return config.viral;
    if (typeof config.heartbeats === 'string') return config.heartbeats;
    return `${title}: {count} total`;
  };
  
  if (count === 1) {
    return getSingleMessage()
      .replace("{user}", username)
      .replace("{target}", targetName || "your pulse");
  }
  
  if (actors.length <= 3) {
    const names = actors.map(a => a.username ? `@${a.username}` : a.name).join(", ");
    return getMultipleMessage()
      .replace("{users}", names)
      .replace("{count}", String(count))
      .replace("{target}", targetName || "your pulse");
  }
  
  const displayedNames = actors.slice(0, 2).map(a => a.username ? `@${a.username}` : a.name).join(", ");
  const remaining = count - 2;
  return getGroupedMessage()
    .replace("{users}", displayedNames)
    .replace("{count}", String(count))
    .replace("{remaining}", String(remaining))
    .replace("{target}", targetName || "your pulse");
}

// Group notifications by key
export function groupNotifications(notifications: Notification[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();
  
  for (const notif of notifications) {
    const key = notif.groupKey || notif.id;
    
    if (groups.has(key)) {
      const group = groups.get(key)!;
      group.notifications.push(notif);
      group.totalCount += notif.groupCount || 1;
      if (notif.actor && !group.actors.find(a => a.id === notif.actor?.id)) {
        group.actors.push(notif.actor);
      }
      if (new Date(notif.createdAt) > new Date(group.latestAt)) {
        group.latestAt = notif.createdAt;
      }
    } else {
      groups.set(key, {
        key,
        type: notif.type,
        notifications: [notif],
        latestAt: notif.createdAt,
        totalCount: notif.groupCount || 1,
        actors: notif.actor ? [notif.actor] : [],
        preview: notif.preview || notif.message,
      });
    }
  }
  
  // Sort by most recent
  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
  );
}

// Get time ago string
export function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
