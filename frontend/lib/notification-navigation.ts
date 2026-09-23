/** @fileOverview Safe internal destinations for verified notification entities. @stability stable */
import type { Notification } from '@/components/uicustom/notifications/types';
export function getNotificationHref(notification: Notification): string | null {
  const segment = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value) ? value : null;
  const trade = segment(notification.metadata?.tradeId);
  if (notification.type.startsWith('TRADE_') && trade) return `/trade/${trade}`;
  if (notification.type === 'SYSTEM' && segment(notification.metadata?.orderId)) return '/my-orders';
  const pulse = segment(notification.pulseId);
  if (pulse) return `/pulse/${pulse}`;
  const conversation = segment(notification.conversationId);
  if (conversation) return ['DM', 'GROUP_MESSAGE'].includes(notification.type) ? `/conversations/${conversation}` : `/pulse/${conversation}`;
  return null;
}
