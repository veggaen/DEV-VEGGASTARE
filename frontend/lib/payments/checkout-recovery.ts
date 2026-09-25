/** @fileOverview Owner-only recovery of existing PayPal orders, without deleting financial history. @stability stable */
import 'server-only';
import { z } from 'zod';
import { dbPrisma } from '@/lib/db';
import { CheckoutError, paypalEnvironment, validateApprovalUrl } from './showcase-policy';
import { beginShowcaseCheckout, completeShowcaseCheckout } from './showcase-store';
import { readPayPalOrder } from './showcase-paypal';
import { checkoutRecovery } from './checkout-recovery-policy';

async function ownedAttempt(orderId: string, userId: string) {
  const attempt = await dbPrisma.checkoutAttempt.findUnique({ where: { orderId } });
  if (!attempt || attempt.userId !== userId) throw new CheckoutError('ORDER_NOT_FOUND', 404);
  if (attempt.environment !== paypalEnvironment().mode) throw new CheckoutError('WRONG_PAYMENT_ENVIRONMENT', 409);
  return attempt;
}

export async function resumeCheckout(orderId: string, userId: string) {
  const attempt = await ownedAttempt(orderId, userId);
  const receiptUrl = `/checkout/receipt/${encodeURIComponent(orderId)}`;
  if (attempt.state === 'COMPLETED') return { nextUrl: receiptUrl };
  if (attempt.paypalOrderId && ['PREPARED', 'APPROVAL_PENDING', 'CAPTURE_PENDING'].includes(attempt.state)) {
    const provider = ProviderOrder.parse(await readPayPalOrder(attempt.paypalOrderId));
    if (provider.id !== attempt.paypalOrderId) throw new CheckoutError('PAYMENT_BINDING_MISMATCH', 409);
    if (provider.status === 'COMPLETED') {
      await completeShowcaseCheckout(orderId, userId, false);
      return { nextUrl: receiptUrl };
    }
  }
  if (!checkoutRecovery(attempt, paypalEnvironment().mode).canResume) {
    throw new CheckoutError(attempt.state === 'CANCELLED' ? 'ORDER_CANCELLED' : 'CHECKOUT_EXPIRED', 409);
  }
  if (attempt.state === 'CAPTURE_PENDING') {
    // Retry the original capture identity, never create another purchase. The
    // completion function independently enforces the original capture window.
    await completeShowcaseCheckout(orderId, userId);
    return { nextUrl: receiptUrl };
  }
  const result = await beginShowcaseCheckout(userId, attempt.requestKey);
  return { nextUrl: 'approvalUrl' in result && result.approvalUrl ? validateApprovalUrl(result.approvalUrl) : receiptUrl };
}

const ProviderOrder = z.object({ id: z.string(), status: z.string(), purchase_units: z.array(z.object({
  payments: z.object({ captures: z.array(z.unknown()).optional(), authorizations: z.array(z.unknown()).optional() }).optional(),
})).optional() });

export async function cancelUnpaidCheckout(orderId: string, userId: string) {
  const attempt = await ownedAttempt(orderId, userId);
  if (attempt.state === 'CANCELLED') return { cancelled: true };
  if (!checkoutRecovery(attempt, paypalEnvironment().mode).canCancel) throw new CheckoutError('ORDER_NOT_CANCELLABLE', 409);
  // Competes atomically with the capture claim. Never cancel while a capture
  // might be in flight, even if the network response has been lost.
  const claimed = await dbPrisma.checkoutAttempt.updateMany({ where: { orderId, userId, captureId: null,
    state: { in: ['PREPARED', 'APPROVAL_PENDING', 'CANCEL_PENDING'] } }, data: { state: 'CANCEL_PENDING' } });
  if (claimed.count !== 1) throw new CheckoutError('ORDER_CHANGED', 409);
  if (attempt.paypalOrderId) {
    const provider = ProviderOrder.parse(await readPayPalOrder(attempt.paypalOrderId));
    if (provider.id !== attempt.paypalOrderId) throw new CheckoutError('PAYMENT_BINDING_MISMATCH', 409);
    if (provider.status === 'COMPLETED') {
      await completeShowcaseCheckout(orderId, userId, false);
      throw new CheckoutError('ORDER_ALREADY_PAID', 409);
    }
    if (!['CREATED', 'SAVED', 'PAYER_ACTION_REQUIRED', 'APPROVED', 'VOIDED'].includes(provider.status) ||
      provider.purchase_units?.some(unit => unit.payments?.captures?.length || unit.payments?.authorizations?.length)) {
      throw new CheckoutError('PAYMENT_STATUS_UNCERTAIN', 409);
    }
  }
  await dbPrisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`fulfill:${orderId}`}, 0))`;
    const cancelled = await tx.checkoutAttempt.updateMany({ where: { orderId, userId, captureId: null, state: 'CANCEL_PENDING' }, data: { state: 'CANCELLED' } });
    if (cancelled.count !== 1) throw new CheckoutError('ORDER_CHANGED', 409);
    await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
  });
  return { cancelled: true };
}
