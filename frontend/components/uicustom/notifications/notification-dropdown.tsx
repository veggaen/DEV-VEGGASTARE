"use client";
/** @fileOverview Collision-aware keyboard-accessible notification popover. @stability stable */
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import Link from '@/components/ui/navigation-link';
import { NotificationBell } from './notification-bell';
import { NotificationItem } from './notification-item';
import type { Notification } from './types';
import { FiSettings } from 'react-icons/fi';
import { getNotificationHref } from '@/lib/notification-navigation';

interface NotificationDropdownProps {
  notifications: Notification[]; unreadCount?: number; isLoading?: boolean; isError?: boolean;
  pending?: boolean; readOnly?: boolean; onRefresh?: () => void;
  onMarkAllRead?: () => void; onMarkRead?: (id: string) => void;
}
export function NotificationDropdown({ notifications, unreadCount = 0, isLoading = false, isError = false, pending = false, readOnly = false, onRefresh, onMarkAllRead, onMarkRead }: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const rows = tab === 'unread' ? notifications.filter(row => !row.isRead) : notifications;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><NotificationBell count={unreadCount} isOpen={open} /></PopoverTrigger>
    <PopoverContent align="end" sideOffset={8} collisionPadding={16} aria-label="Notification inbox"
      className="flex max-h-[var(--radix-popover-content-available-height)] w-96 max-w-[var(--radix-popover-content-available-width)] flex-col overflow-hidden rounded-2xl border-border p-0 duration-150 motion-reduce:animate-none">
      <div className="shrink-0 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Notifications</h2>
          <Button asChild variant="ghost" size="icon" className="h-11 w-11"><Link href="/settings?section=notifications" aria-label="Notification settings" onClick={() => setOpen(false)}><FiSettings aria-hidden /></Link></Button>
        </div>
        <div className="mt-1 flex gap-1" role="group" aria-label="Notification filters">
          {(['all', 'unread'] as const).map(value => <Button key={value} variant={tab === value ? 'secondary' : 'ghost'} className="h-11 flex-1" aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'all' ? 'All' : 'Unread'}</Button>)}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-notification-scroll>
        {isError ? <div role="alert" className="p-4 text-sm"><p>Could not load notifications.</p><Button variant="outline" className="mt-3 h-11" onClick={onRefresh}>Try again</Button></div>
          : isLoading ? <div role="status" className="space-y-2 p-3"><span className="sr-only">Loading notifications…</span>{[0, 1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-muted motion-safe:animate-pulse" />)}</div>
          : rows.length === 0 ? <div className="p-6 text-sm text-muted-foreground">{tab === 'unread' ? 'All caught up. No unread notifications.' : 'No notifications yet. Order and account updates will appear here.'}</div>
          : <ul className="divide-y divide-border">{rows.map(row => <li key={row.id}><NotificationItem notification={row} compact onMarkRead={readOnly || pending || row.isRead ? undefined : () => onMarkRead?.(row.id)} onClick={getNotificationHref(row) ? () => setOpen(false) : undefined} /></li>)}</ul>}
      </div>
      <div className="shrink-0 border-t border-border p-2">
        {readOnly ? <p className="px-2 py-1 text-xs text-muted-foreground">Demo notifications are read-only.</p>
          : unreadCount > 0 && <Button variant="ghost" className="min-h-11 w-full" disabled={pending} onClick={onMarkAllRead}>{pending ? 'Saving…' : 'Mark all as read'}</Button>}
        <Button asChild variant="ghost" className="min-h-11 w-full"><Link href="/notifications" onClick={() => setOpen(false)}>View all notifications</Link></Button>
      </div>
    </PopoverContent>
  </Popover>;
}
