"use client";
/** @fileOverview Paginated private inbox with confirmed writes and bounded requests. @stability stable */
import useSWRInfinite from 'swr/infinite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { groupNotifications, type Notification } from '@/components/uicustom/notifications/types';

interface InboxPage { notifications: Notification[]; nextCursor: string | null; unreadCount: number }
interface InboxOptions {
  limit?: number; unreadOnly?: boolean; archived?: boolean;
  refreshInterval?: number; enabled?: boolean; readOnly?: boolean; userId?: string;
}
export async function notificationRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  if (!response.ok) {
    const message = response.status === 429 ? 'Too many requests. Wait a moment and try again.'
      : response.status === 401 ? 'Your session expired. Please sign in again.'
      : response.status === 403 ? 'This account cannot change notifications.'
      : !init?.method || init.method === 'GET' ? 'Could not load notifications. Please try again.' : 'Notifications could not be updated. Please try again.';
    throw Object.assign(new Error(message), { status: response.status });
  }
  return response.json();
}

export function useNotificationInbox({ limit = 50, unreadOnly = false, archived = false, refreshInterval = 30000, enabled = true, readOnly = false, userId = '' }: InboxOptions = {}) {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<InboxPage>(
    (index, previous: InboxPage | null) => {
      if (!enabled || (index > 0 && !previous?.nextCursor)) return null;
      const params = new URLSearchParams({ limit: String(limit), unread: String(unreadOnly), archived: String(archived) });
      if (index > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
      // Identity participates in the cache key, never in the server's authorization.
      return [`/api/notifications?${params}`, userId];
    },
    async ([url]: [string, string]) => {
      const result = await notificationRequest(url);
      if (!Array.isArray(result.notifications) || typeof result.unreadCount !== 'number') throw new Error('Invalid notification response. Please try again.');
      return result;
    },
    // Always revalidate a revisited filter: a write in Archived may have changed
    // the inactive Inbox cache only a moment ago. Keep its rows during the read.
    { refreshInterval: latest => latest ? refreshInterval : 0, revalidateOnFocus: false, revalidateAll: true, dedupingInterval: 0, shouldRetryOnError: false, persistSize: false },
  );
  useEffect(() => {
    const refresh = () => { void mutate(); };
    window.addEventListener('notification-refresh', refresh);
    return () => window.removeEventListener('notification-refresh', refresh);
  }, [mutate]);

  const write = useCallback(async (path: string, method: string, body?: object) => {
    if (readOnly || lock.current) return false;
    lock.current = true; setPending(true);
    try {
      await notificationRequest(path, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      // Do not pretend a rejected mutation succeeded, or decrement an already-read badge.
      window.dispatchEvent(new Event('notification-refresh'));
      return true;
    } catch (failure) {
      toast.error(failure instanceof Error && failure.name !== 'TimeoutError' ? failure.message : 'The request timed out. Refresh to see the saved state before retrying.');
      window.dispatchEvent(new Event('notification-refresh'));
      return false;
    } finally { lock.current = false; setPending(false); }
  }, [readOnly]);
  const updateNotification = useCallback((id: string, patch: { isRead?: boolean; isArchived?: boolean }) => write(`/api/notifications/${encodeURIComponent(id)}`, 'PATCH', patch), [write]);
  const notifications = Array.from(new Map((data ?? []).flatMap(page => page.notifications).map(row => [row.id, row])).values());
  return {
    notifications, groupedNotifications: groupNotifications(notifications), unreadCount: data?.[0]?.unreadCount ?? 0,
    nextCursor: data?.at(-1)?.nextCursor ?? null, isLoading: enabled && isLoading,
    isRefreshing: isValidating && !!data, isLoadingMore: size > (data?.length ?? 0) && isValidating,
    isError: !!error, error, pending, readOnly, updateNotification,
    markAsRead: (id: string) => updateNotification(id, { isRead: true }),
    markAllAsRead: () => write('/api/notifications/mark-all-read', 'POST'),
    archiveNotification: (id: string) => updateNotification(id, { isArchived: true }),
    deleteNotification: (id: string) => write(`/api/notifications/${encodeURIComponent(id)}`, 'DELETE'),
    refresh: () => mutate(),
    loadMore: () => { if (!isValidating && data?.at(-1)?.nextCursor) void setSize(size + 1); },
  };
}
