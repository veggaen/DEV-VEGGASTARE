"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { notificationTypes, notificationCategories, presenceStatuses } from "@/lib/pulse-labels";
import type { NotificationSettings as NotificationSettingsType, NotificationMute } from "./types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  FiBell, FiMail, FiSmartphone, FiMoon, FiClock, 
  FiVolume2, FiVolumeX, FiTrash2, FiChevronDown, FiChevronRight 
} from "react-icons/fi";
import { FaUser } from "react-icons/fa";

// Helper function to map icon names to emojis
function getCategoryEmoji(icon: string): string {
  const iconMap: Record<string, string> = {
    heart: "❤️",
    users: "👥",
    "message-circle": "💬",
    "trending-up": "📈",
    sparkles: "✨",
  };
  return iconMap[icon] || "📌";
}

// Helper to get description from notification type
function getNotificationTypeDescription(type: typeof notificationTypes[keyof typeof notificationTypes]): string {
  const t = type as Record<string, unknown>;
  if (typeof t.single === 'string') return t.single.replace("{user}", "users").replace("{target}", "your content");
  if (typeof t.alert === 'string') return t.alert.replace("{bpm}", "100");
  if (typeof t.prompt === 'string') return t.prompt;
  if (typeof t.syncs === 'string') return (t.syncs as string).replace("{count}", "1000");
  return (t.title as string) || "Notifications";
}

interface NotificationSettingsProps {
  settings: NotificationSettingsType;
  mutes: NotificationMute[];
  onSettingsChange: (settings: Partial<NotificationSettingsType>) => void;
  onRemoveMute: (muteId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function NotificationSettings({
  settings,
  mutes,
  onSettingsChange,
  onRemoveMute,
  isLoading = false,
  className
}: NotificationSettingsProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>("engagement");
  
  // Map notification types to their settings keys
  const typeToSettingKey: Record<string, keyof NotificationSettingsType> = {
    HEARTBEAT: "heartbeatEnabled",
    VIBE: "vibeEnabled",
    REPULSE: "repulseEnabled",
    REPLY: "replyEnabled",
    SYNC: "syncEnabled",
    DM: "dmEnabled",
    GROUP_MESSAGE: "groupMessageEnabled",
    MENTION: "mentionEnabled",
    HOT_PULSE: "hotPulseEnabled",
    MILESTONE: "milestoneEnabled",
    VIBE_CHECK: "vibeCheckEnabled",
  };
  
  const handleToggle = (key: keyof NotificationSettingsType, value: boolean) => {
    onSettingsChange({ [key]: value });
  };
  
  return (
    <div className={cn("space-y-6", className)}>
      {/* Delivery Channels */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Notification Channels
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <FiBell className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  In-app notifications
                </Label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Show notifications in the app
                </p>
              </div>
            </div>
            <Switch
              checked={settings.inAppEnabled}
              onCheckedChange={(checked) => handleToggle("inAppEnabled", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <FiSmartphone className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Push notifications
                </Label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Receive notifications on your device
                </p>
              </div>
            </div>
            <Switch
              checked={settings.pushEnabled}
              onCheckedChange={(checked) => handleToggle("pushEnabled", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <FiMail className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Email digest
                </Label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Daily summary of missed notifications
                </p>
              </div>
            </div>
            <Switch
              checked={settings.emailDigestEnabled}
              onCheckedChange={(checked) => handleToggle("emailDigestEnabled", checked)}
            />
          </div>
        </div>
      </section>
      
      {/* Smart Features */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Smart Features
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <span className="text-base">💓</span>
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Condense notifications
                </Label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Group similar notifications together
                </p>
              </div>
            </div>
            <Switch
              checked={settings.condenseNotifications}
              onCheckedChange={(checked) => handleToggle("condenseNotifications", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <span className="text-base">👀</span>
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Show previews
                </Label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Show message content in notifications
                </p>
              </div>
            </div>
            <Switch
              checked={settings.showPreviews}
              onCheckedChange={(checked) => handleToggle("showPreviews", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <span className="text-base">✍️</span>
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Typing indicators
                </Label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Show when someone is about to react
                </p>
              </div>
            </div>
            <Switch
              checked={settings.showTypingIndicators}
              onCheckedChange={(checked) => handleToggle("showTypingIndicators", checked)}
            />
          </div>
        </div>
      </section>
      
      {/* Quiet Hours */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Quiet Hours
        </h3>
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                <FiMoon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Enable quiet hours
                </Label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Pause notifications during set times
                </p>
              </div>
            </div>
            <Switch
              checked={settings.quietHoursEnabled}
              onCheckedChange={(checked) => handleToggle("quietHoursEnabled", checked)}
            />
          </div>
          
          {settings.quietHoursEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-700"
            >
              <FiClock className="h-4 w-4 text-zinc-400" />
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={settings.quietHoursStart}
                  onChange={(e) => onSettingsChange({ quietHoursStart: e.target.value })}
                  className="px-2 py-1 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100"
                />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">to</span>
                <input
                  type="time"
                  value={settings.quietHoursEnd}
                  onChange={(e) => onSettingsChange({ quietHoursEnd: e.target.value })}
                  className="px-2 py-1 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </motion.div>
          )}
        </div>
      </section>
      
      {/* Notification Types by Category */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Notification Types
        </h3>
        <div className="space-y-2">
          {Object.entries(notificationCategories).map(([categoryKey, category]) => (
            <div 
              key={categoryKey}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              {/* Category header */}
              <button
                type="button"
                onClick={() => setExpandedCategory(
                  expandedCategory === categoryKey ? null : categoryKey
                )}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getCategoryEmoji(category.icon)}</span>
                  <div className="text-left">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {category.label}
                    </span>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {category.description}
                    </p>
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: expandedCategory === categoryKey ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <FiChevronDown className="h-4 w-4 text-zinc-400" />
                </motion.div>
              </button>
              
              {/* Category items */}
              <AnimatePresence>
                {expandedCategory === categoryKey && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <div className="p-2">
                      {category.types.map((typeKey) => {
                        const type = notificationTypes[typeKey as keyof typeof notificationTypes];
                        const settingKey = typeToSettingKey[typeKey];
                        if (!type || !settingKey) return null;
                        
                        return (
                          <div 
                            key={typeKey}
                            className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span 
                                className="text-base"
                                style={{ color: type.color }}
                              >
                                {type.emoji}
                              </span>
                              <div>
                                <span className="text-sm text-zinc-900 dark:text-zinc-100">
                                  {type.title}
                                </span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {getNotificationTypeDescription(type)}
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={settings[settingKey] as boolean}
                              onCheckedChange={(checked) => handleToggle(settingKey, checked)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>
      
      {/* Muted Users/Conversations */}
      {mutes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Muted
          </h3>
          <div className="space-y-2">
            {mutes.map((mute) => (
              <div 
                key={mute.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-9 w-9 border border-zinc-200 dark:border-zinc-700 opacity-50">
                      <AvatarImage src="/users/avatar.webp" />
                      <AvatarFallback className="bg-zinc-200 dark:bg-zinc-700">
                        <FaUser className="h-3.5 w-3.5 text-zinc-400" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute inset-0 flex items-center justify-center">
                      <FiVolumeX className="h-4 w-4 text-zinc-500" />
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {mute.targetName || "Unknown"}
                    </span>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {mute.muteType === "USER" && "User muted"}
                      {mute.muteType === "CONVERSATION" && "Conversation muted"}
                      {mute.muteType === "COMPANY" && "Company muted"}
                      {mute.expiresAt && ` · Expires ${new Date(mute.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveMute(mute.id)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                  title="Unmute"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Compact version for the settings page section
interface NotificationSettingsCompactProps {
  settings: NotificationSettingsType;
  onSettingsChange: (settings: Partial<NotificationSettingsType>) => void;
  className?: string;
}

export function NotificationSettingsCompact({
  settings,
  onSettingsChange,
  className
}: NotificationSettingsCompactProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FiBell className="h-4 w-4 text-zinc-500" />
          <Label className="text-sm text-zinc-700 dark:text-zinc-300">
            Push notifications
          </Label>
        </div>
        <Switch
          checked={settings.pushEnabled}
          onCheckedChange={(checked) => onSettingsChange({ pushEnabled: checked })}
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FiMail className="h-4 w-4 text-zinc-500" />
          <Label className="text-sm text-zinc-700 dark:text-zinc-300">
            Email notifications
          </Label>
        </div>
        <Switch
          checked={settings.emailDigestEnabled}
          onCheckedChange={(checked) => onSettingsChange({ emailDigestEnabled: checked })}
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm">💓</span>
          <Label className="text-sm text-zinc-700 dark:text-zinc-300">
            Condense heartbeats
          </Label>
        </div>
        <Switch
          checked={settings.condenseNotifications}
          onCheckedChange={(checked) => onSettingsChange({ condenseNotifications: checked })}
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FiMoon className="h-4 w-4 text-zinc-500" />
          <Label className="text-sm text-zinc-700 dark:text-zinc-300">
            Quiet hours
          </Label>
        </div>
        <Switch
          checked={settings.quietHoursEnabled}
          onCheckedChange={(checked) => onSettingsChange({ quietHoursEnabled: checked })}
        />
      </div>
    </div>
  );
}
