"use client";
/** @fileOverview Responsive private inbox with URL filters and confirmed state changes. @stability stable */
import { useSearchParams } from 'next/navigation';
import Link from '@/components/ui/navigation-link';
import { Button } from '@/components/ui/button';
import { FiBell, FiRefreshCw, FiSettings } from 'react-icons/fi';
import { NotificationItem } from '@/components/uicustom/notifications/notification-item';
import { useNotifications } from '@/hooks/use-notifications';
import { useCurrentUser } from '@/hooks/use-current-user';
import { isDemoUserId } from '@/lib/demo-policy';

export default function NotificationsPage() {
  const user = useCurrentUser();
  const query = useSearchParams();
  const filter = query.get('filter');
  const tab = filter === 'unread' || filter === 'archived' ? filter : 'all';
  const readOnly = isDemoUserId(user?.id);
  const inbox = useNotifications({ limit: 20, unreadOnly: tab === 'unread', archived: tab === 'archived', enabled: !!user, userId: user?.id, readOnly, refreshInterval: 60000 });
  const selectTab = (value: string) => {
    const params = new URLSearchParams(query);
    if (value === 'all') params.delete('filter'); else params.set('filter', value);
    window.history.pushState(null, '', '/notifications' + (params.size ? '?' + params.toString() : ''));
  };
  const loading = !user || inbox.isLoading;
  return <section aria-labelledby="notifications-title" className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="notifications-title" className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><FiBell className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">{loading ? 'Your order and account updates' : `${inbox.unreadCount} unread in your inbox`}</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button variant="outline" className="h-11 flex-1 gap-2 sm:flex-none" disabled={inbox.isRefreshing || loading} onClick={() => void inbox.refresh()}><FiRefreshCw aria-hidden />{inbox.isRefreshing ? 'Refreshing…' : 'Refresh'}</Button>
          <Button variant="outline" asChild className="h-11 flex-1 gap-2 sm:flex-none"><Link href="/settings?section=notifications"><FiSettings aria-hidden />Settings</Link></Button>
        </div>
      </div>
      {readOnly && <p className="mb-4 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">Demo notifications are read-only. Sign in to your own account to mark updates as read or archive them.</p>}
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-muted/50 p-1" role="group" aria-label="Notification filters">
        {(['all', 'unread', 'archived'] as const).map(value => <Button key={value} variant={tab === value ? 'secondary' : 'ghost'} className="h-11 min-w-0 px-2 capitalize" aria-pressed={tab === value} onClick={() => selectTab(value)}>{value === 'all' ? 'Inbox' : value}</Button>)}
      </div>
      {!readOnly && tab !== 'archived' && <div className="mb-3 flex justify-end"><Button variant="ghost" className="h-11" disabled={inbox.pending || !inbox.unreadCount || loading} onClick={() => void inbox.markAllAsRead()}>{inbox.pending ? 'Saving…' : 'Mark all as read'}</Button></div>}
      {inbox.isError && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>{inbox.error instanceof Error ? inbox.error.message : 'Could not load notifications.'}</p><Button className="mt-3 h-11" variant="outline" onClick={() => void inbox.refresh()}>Try again</Button></div>}
      {loading ? <div role="status" aria-label="Loading notifications" className="space-y-3">{[0, 1, 2, 3, 4].map(i => <div key={i} className="flex min-h-28 gap-3 rounded-xl border border-border p-4"><span className="h-10 w-10 shrink-0 rounded-xl bg-muted motion-safe:animate-pulse" /><span className="flex-1 space-y-3 py-1"><span className="block h-4 w-2/3 rounded bg-muted motion-safe:animate-pulse" /><span className="block h-4 rounded bg-muted motion-safe:animate-pulse" /><span className="block h-3 w-20 rounded bg-muted motion-safe:animate-pulse" /></span></div>)}</div>
        : inbox.notifications.length ? <ul aria-label="Notifications" className="space-y-3">
          {inbox.notifications.map(row => <li key={row.id} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
            <NotificationItem notification={row} onMarkRead={readOnly || inbox.pending || row.isRead ? undefined : () => void inbox.markAsRead(row.id)} />
            {!readOnly && <div className="flex flex-wrap justify-end gap-1 border-t border-border px-2 py-1">
              <Button variant="ghost" className="h-11" disabled={inbox.pending} onClick={() => void inbox.updateNotification(row.id, { isRead: !row.isRead })}>{row.isRead ? 'Mark unread' : 'Mark read'}</Button>
              <Button variant="ghost" className="h-11" disabled={inbox.pending} onClick={() => void inbox.updateNotification(row.id, { isArchived: !row.isArchived })}>{row.isArchived ? 'Restore to inbox' : 'Archive'}</Button>
            </div>}
          </li>)}
        </ul>
        : !inbox.isError && <div className="rounded-2xl border border-border border-dashed px-6 py-12 text-center"><FiBell className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden /><h2 className="text-lg font-semibold">{tab === 'archived' ? 'No archived notifications' : tab === 'unread' ? 'All caught up' : 'No notifications yet'}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{tab === 'archived' ? 'Archived updates stay here until you restore them.' : 'Order, message, and account updates will appear here.'}</p></div>}
      {inbox.nextCursor && <div className="mt-5 flex justify-center"><Button variant="outline" className="h-11" disabled={inbox.isRefreshing} onClick={inbox.loadMore}>{inbox.isLoadingMore ? 'Loading more…' : 'Load more notifications'}</Button></div>}
    </div>
  </section>;
}
