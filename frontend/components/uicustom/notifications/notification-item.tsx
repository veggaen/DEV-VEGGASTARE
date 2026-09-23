"use client";
/** @fileOverview Shared notification content with real links and no layout-shifting entrance. @stability stable */
import { cn } from '@/lib/utils';
import Link from '@/components/ui/navigation-link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getNotificationConfig, getTimeAgo, type Notification, type NotificationGroup } from './types';
import { getNotificationHref } from '@/lib/notification-navigation';
import Image from 'next/image';

interface NotificationItemProps { notification: Notification; onClick?: () => void; onMarkRead?: () => void; compact?: boolean; className?: string }
export function NotificationItem({ notification, onClick, onMarkRead, compact = false, className }: NotificationItemProps) {
  const config = getNotificationConfig(notification.type);
  const href = getNotificationHref(notification);
  const content = <>
    <div className="shrink-0" aria-hidden>
      {notification.actor ? <Avatar className="h-10 w-10"><AvatarImage src={notification.actor.image || undefined} alt="" /><AvatarFallback>{notification.actor.name?.slice(0, 1) || 'V'}</AvatarFallback></Avatar>
        : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-lg">{config.emoji}</span>}
    </div>
    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
      <p className="text-sm font-semibold text-foreground">{notification.title}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{notification.message}</p>
      {notification.preview && !compact && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{notification.preview}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <time dateTime={new Date(notification.createdAt).toISOString()} title={new Date(notification.createdAt).toLocaleString()}>{getTimeAgo(notification.createdAt)}</time>
        {!notification.isRead && <span className="font-medium text-emerald-700 dark:text-emerald-400">Unread</span>}
        {notification.groupCount > 1 && <span>{notification.groupCount} updates</span>}
        {href && <span className="font-medium text-foreground">View details →</span>}
      </div>
    </div>
    {notification.imageUrl && !compact && <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg"><Image src={notification.imageUrl} alt="" fill sizes="48px" className="object-cover" /></span>}
  </>;
  const classes = cn('relative flex w-full min-w-0 gap-3 rounded-xl p-4 text-left', !notification.isRead && 'bg-muted/30', href && 'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', className);
  const activate = () => { if (!notification.isRead) onMarkRead?.(); onClick?.(); };
  if (href) return <Link href={href} className={classes} onClick={activate}>{content}</Link>;
  return <div className={classes}>{content}</div>;
}
export function GroupedNotificationItem({ group, onClick, className }: { group: NotificationGroup; onClick?: () => void; className?: string }) {
  const first = group.notifications[0];
  if (!first) return null;
  return <NotificationItem notification={{ ...first, groupCount: group.totalCount, isRead: group.notifications.every(row => row.isRead) }} onClick={onClick} className={className} />;
}
