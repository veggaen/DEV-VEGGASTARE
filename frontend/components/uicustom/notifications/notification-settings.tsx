"use client";

/**
 * @fileOverview  Notification preferences: delivery channels, smart features,
 *                trading alerts, quiet hours, per-type toggles grouped by
 *                category, and the mute list. Rows live in trailing-box lists;
 *                tokens only, both themes.
 * @stability     evolving
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiBell, FiChevronDown, FiClock, FiHeart, FiMail, FiMessageCircle, FiMoon, FiSmartphone, FiStar, FiTrendingUp, FiUsers, FiVolumeX, FiZap } from "react-icons/fi";
import { notificationCategories, notificationTypes } from "@/lib/pulse-labels";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HoverChaser } from "@/components/uicustom/chrome/hover-chaser";
import { RowList, RowsSkeleton, SettingsCard, SettingsGroup, SettingsRow, settingsCard } from "@/components/uicustom/settings/settings-primitives";
import { useHydratedReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import { cn } from "@/lib/utils";
import type { NotificationMute, NotificationSettings as NotificationSettingsType } from "./types";

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  heart: <FiHeart />, users: <FiUsers />, "message-circle": <FiMessageCircle />, "trending-up": <FiTrendingUp />, sparkles: <FiStar />,
};

function typeDescription(type: (typeof notificationTypes)[keyof typeof notificationTypes]): string {
  const t = type as Record<string, unknown>;
  if (typeof t.single === "string") return t.single.replace("{user}", "users").replace("{target}", "your content");
  if (typeof t.alert === "string") return t.alert.replace("{bpm}", "100");
  if (typeof t.prompt === "string") return t.prompt;
  if (typeof t.syncs === "string") return t.syncs.replace("{count}", "1000");
  return (t.title as string) || "Notifications";
}

const TYPE_TO_KEY: Record<string, keyof NotificationSettingsType> = {
  HEARTBEAT: "heartbeatEnabled", VIBE: "vibeEnabled", REPULSE: "repulseEnabled", REPLY: "replyEnabled", SYNC: "syncEnabled", DM: "dmEnabled",
  GROUP_MESSAGE: "groupMessageEnabled", MENTION: "mentionEnabled", HOT_PULSE: "hotPulseEnabled", MILESTONE: "milestoneEnabled", VIBE_CHECK: "vibeCheckEnabled",
};

interface NotificationSettingsProps {
  settings: NotificationSettingsType;
  mutes: NotificationMute[];
  onSettingsChange: (settings: Partial<NotificationSettingsType>) => void;
  onRemoveMute: (muteId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function NotificationSettings({ settings, mutes, onSettingsChange, onRemoveMute, isLoading = false, className }: NotificationSettingsProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>("engagement");
  const reduceMotion = useHydratedReducedMotion();
  const toggle = (key: keyof NotificationSettingsType, value: boolean) => onSettingsChange({ [key]: value });
  const timeField = "min-h-9 rounded-lg border border-border/70 bg-background/60 px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-foreground/[0.04]";

  if (isLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        <RowsSkeleton rows={3} label="Loading notification settings" />
        <RowsSkeleton rows={3} label="Loading notification types" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <SettingsGroup title="Channels" description="Where notifications are delivered.">
        <RowList aria-label="Notification channels">
          <SettingsRow icon={<FiBell />} title="In-app notifications" description="Show notifications inside the app" htmlFor="notif-inapp">
            <Switch id="notif-inapp" checked={settings.inAppEnabled} onCheckedChange={(v) => toggle("inAppEnabled", v)} />
          </SettingsRow>
          <SettingsRow icon={<FiSmartphone />} title="Push notifications" description="Receive notifications on your device" htmlFor="notif-push">
            <Switch id="notif-push" checked={settings.pushEnabled} onCheckedChange={(v) => toggle("pushEnabled", v)} />
          </SettingsRow>
          <SettingsRow icon={<FiMail />} title="Email digest" description="A daily summary of what you missed" htmlFor="notif-email">
            <Switch id="notif-email" checked={settings.emailDigestEnabled} onCheckedChange={(v) => toggle("emailDigestEnabled", v)} />
          </SettingsRow>
        </RowList>
      </SettingsGroup>

      <SettingsGroup title="Smart features">
        <RowList aria-label="Smart features">
          <SettingsRow icon={<FiZap />} title="Condense notifications" description="Group similar notifications together" htmlFor="notif-condense">
            <Switch id="notif-condense" checked={settings.condenseNotifications} onCheckedChange={(v) => toggle("condenseNotifications", v)} />
          </SettingsRow>
          <SettingsRow icon={<FiMessageCircle />} title="Show previews" description="Show message content in notifications" htmlFor="notif-previews">
            <Switch id="notif-previews" checked={settings.showPreviews} onCheckedChange={(v) => toggle("showPreviews", v)} />
          </SettingsRow>
          <SettingsRow icon={<FiUsers />} title="Typing indicators" description="Show when someone is about to react" htmlFor="notif-typing">
            <Switch id="notif-typing" checked={settings.showTypingIndicators} onCheckedChange={(v) => toggle("showTypingIndicators", v)} />
          </SettingsRow>
        </RowList>
      </SettingsGroup>

      <SettingsGroup title="Trading">
        <RowList aria-label="Trading notifications">
          <SettingsRow icon={<FiTrendingUp />} title="Paper order fills" description="Tell me when a resting limit or stop order fills, or cannot fill" htmlFor="notif-paper">
            <Switch id="notif-paper" checked={settings.paperOrderEnabled ?? true} onCheckedChange={(v) => toggle("paperOrderEnabled", v)} />
          </SettingsRow>
        </RowList>
      </SettingsGroup>

      <SettingsGroup title="Quiet hours">
        <SettingsCard className="space-y-3 p-1 sm:p-1">
          <SettingsRow icon={<FiMoon />} title="Enable quiet hours" description="Pause notifications during set times" htmlFor="notif-quiet">
            <Switch id="notif-quiet" checked={settings.quietHoursEnabled} onCheckedChange={(v) => toggle("quietHoursEnabled", v)} />
          </SettingsRow>
          <AnimatePresence initial={false}>
            {settings.quietHoursEnabled && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-3 border-t border-border/50 px-3 py-3">
                  <FiClock className="size-4 text-muted-foreground" aria-hidden="true" />
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">From
                    <input type="time" aria-label="Quiet hours start" value={settings.quietHoursStart} onChange={(e) => onSettingsChange({ quietHoursStart: e.target.value })} className={timeField} />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">to
                    <input type="time" aria-label="Quiet hours end" value={settings.quietHoursEnd} onChange={(e) => onSettingsChange({ quietHoursEnd: e.target.value })} className={timeField} />
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Notification types" description="Fine-tune each kind of event.">
        <HoverChaser className="space-y-2" boxClassName="rounded-2xl">
          {Object.entries(notificationCategories).map(([categoryKey, category]) => {
            const open = expandedCategory === categoryKey;
            return (
              <div key={categoryKey} className={cn(settingsCard, "overflow-hidden")}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpandedCategory(open ? null : categoryKey)}
                  data-chase
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-accent/10 text-brand-accent [&>svg]:size-4">{CATEGORY_ICON[category.icon] ?? <FiBell />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{category.label}</span>
                    <span className="block text-xs text-muted-foreground">{category.description}</span>
                  </span>
                  <FiChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-border/50"
                    >
                      <div className="space-y-0.5 p-1">
                        {category.types.map((typeKey) => {
                          const type = notificationTypes[typeKey as keyof typeof notificationTypes];
                          const settingKey = TYPE_TO_KEY[typeKey];
                          if (!type || !settingKey) return null;
                          const id = `notif-type-${typeKey.toLowerCase()}`;
                          return (
                            <SettingsRow key={typeKey} icon={<span className="text-base" style={{ color: type.color }}>{type.emoji}</span>} title={type.title} description={typeDescription(type)} htmlFor={id} className="min-h-12 py-2">
                              <Switch id={id} checked={Boolean(settings[settingKey])} onCheckedChange={(v) => toggle(settingKey, v)} />
                            </SettingsRow>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </HoverChaser>
      </SettingsGroup>

      {mutes.length > 0 && (
        <SettingsGroup title="Muted" description="People, conversations and companies you have silenced.">
          <RowList aria-label="Muted">
            {mutes.map((mute) => (
              <SettingsRow
                key={mute.id}
                icon={<Avatar className="size-8 border border-border/60 opacity-70"><AvatarFallback className="bg-muted"><FiVolumeX className="size-3.5 text-muted-foreground" aria-hidden="true" /></AvatarFallback></Avatar>}
                title={mute.targetName || "Unknown"}
                description={`${mute.muteType === "USER" ? "User" : mute.muteType === "CONVERSATION" ? "Conversation" : "Company"} muted${mute.expiresAt ? ` · expires ${new Date(mute.expiresAt).toLocaleDateString()}` : ""}`}
              >
                <button type="button" onClick={() => onRemoveMute(mute.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-[background-color,color] duration-150 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Unmute</button>
              </SettingsRow>
            ))}
          </RowList>
        </SettingsGroup>
      )}
    </div>
  );
}

/** Compact version for inline panels: the four switches that matter most. */
export function NotificationSettingsCompact({ settings, onSettingsChange, className }: { settings: NotificationSettingsType; onSettingsChange: (settings: Partial<NotificationSettingsType>) => void; className?: string }) {
  const rows: { key: keyof NotificationSettingsType; label: string; icon: React.ReactNode }[] = [
    { key: "pushEnabled", label: "Push notifications", icon: <FiBell /> },
    { key: "emailDigestEnabled", label: "Email notifications", icon: <FiMail /> },
    { key: "condenseNotifications", label: "Condense heartbeats", icon: <FiZap /> },
    { key: "quietHoursEnabled", label: "Quiet hours", icon: <FiMoon /> },
  ];
  return (
    <div className={cn("space-y-4", className)}>
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-muted-foreground [&>svg]:size-4">
            {row.icon}
            <Label htmlFor={`compact-${row.key}`} className="text-sm text-foreground/85">{row.label}</Label>
          </div>
          <Switch id={`compact-${row.key}`} checked={Boolean(settings[row.key])} onCheckedChange={(checked) => onSettingsChange({ [row.key]: checked })} />
        </div>
      ))}
    </div>
  );
}
