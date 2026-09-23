/** @fileOverview Display payment provenance without confusing demo value with money charged. @stability stable */
import type { OrderDto } from '@/lib/types/orders';

export function orderReceiptHref(order: Pick<OrderDto, 'id' | 'checkout'>) {
  return `${order.checkout ? '/checkout/receipt' : '/order-confirmation'}/${encodeURIComponent(order.id)}`;
}

export function orderStatusLabel(order: Pick<OrderDto, 'status' | 'checkout' | 'payment'>) {
  const checkout = order.checkout;
  if (checkout?.state === 'REFUNDED') return 'Refunded';
  if (checkout?.environment === 'DEMO') return checkout.state === 'COMPLETED' ? 'Demo ready' : 'Demo pending';
  if (checkout?.environment === 'SANDBOX') return checkout.state === 'COMPLETED' && checkout.captureId ? 'Sandbox verified' : 'Sandbox pending';
  if (checkout) return checkout.state === 'COMPLETED' && checkout.captureId ? 'Payment verified' : 'Awaiting payment';
  // Legacy COMPLETED alone is not evidence of a payment.
  if (order.status === 'COMPLETED' && order.payment?.status === 'COMPLETED') return 'Paid';
  return ({ COMPLETED: 'Completed', CONFIRMING: 'Confirming', PENDING: 'Pending', CANCELLED: 'Cancelled', FAILED: 'Failed' })[order.status] ?? order.status;
}

export function orderMoney(amount: number, currency?: string | null) {
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, currencyDisplay: 'code' }).format(amount);
  }
  return `${new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} (currency not recorded)`;
}
