/** @fileOverview Notification links must stay internal and target real routes. @stability stable */
import { expect, it } from 'vitest';
import { getNotificationHref } from './notification-navigation';
import { getNotificationConfig, type Notification } from '@/components/uicustom/notifications/types';
const row = (value: Partial<Notification>) => value as Notification;
it('maps messages, pulses, orders and trades to real routes', () => {
  expect(getNotificationHref(row({ type: 'DM', conversationId: 'abc' }))).toBe('/conversations/abc');
  expect(getNotificationHref(row({ type: 'REPLY', conversationId: 'abc' }))).toBe('/pulse/abc');
  expect(getNotificationHref(row({ type: 'SYSTEM', metadata: { orderId: 'abc' } }))).toBe('/my-orders');
  expect(getNotificationHref(row({ type: 'TRADE_COMPLETED', metadata: { tradeId: 'abc' } }))).toBe('/trade/abc');
});
it('never follows arbitrary metadata URLs or unsafe segments', () => {
  expect(getNotificationHref(row({ type: 'SYSTEM', metadata: { href: 'https://evil.test' } }))).toBeNull();
  expect(getNotificationHref(row({ type: 'DM', conversationId: '../admin' }))).toBeNull();
  expect(getNotificationHref(row({ type: 'TRADE_REQUEST', metadata: { tradeId: 'javascript:alert(1)' } }))).toBeNull();
});
it('always displays system and unknown notification content', () => {
  expect(getNotificationConfig('SYSTEM')).toBeTruthy();
  expect(getNotificationConfig('UNKNOWN' as Notification['type'])).toBeTruthy();
});
