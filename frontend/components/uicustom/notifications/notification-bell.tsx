"use client";
/** @fileOverview Accessible, stable notification trigger. @stability stable */
import type { ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/utils';
import { FiBell } from 'react-icons/fi';

type NotificationBellProps = ComponentPropsWithRef<'button'> & { count?: number; hasUnread?: boolean; hasTradeRequest?: boolean; isOpen?: boolean };
export function NotificationBell({ count = 0, hasUnread = false, hasTradeRequest = false, isOpen = false, className, ...props }: NotificationBellProps) {
  return <button type="button" aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
    className={cn('relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', isOpen && 'bg-muted text-foreground', className)} {...props}>
    <FiBell className="h-[18px] w-[18px]" aria-hidden />
    {(hasUnread || count > 0) && <span aria-hidden className={cn('absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white', hasTradeRequest ? 'bg-purple-700' : 'bg-emerald-700')}>{count > 99 ? '99+' : count || ''}</span>}
  </button>;
}
export function NotificationBellMini(props: NotificationBellProps) { return <NotificationBell {...props} />; }
