/** @fileOverview Idempotent verified refund/reversal reconciliation; never initiates refunds or charges. @stability experimental */
import 'server-only';
import type { PrismaClient } from '@/generated/prisma/client';
import { dbPrisma } from '@/lib/db';
import { applyAiCreditDelta } from '@/lib/ai-credit-adjustment';
import { CheckoutError, paypalEnvironment } from './showcase-policy';
import { readPayPalCapture, readPayPalRefund } from './showcase-paypal';
import { PayPalAdjustmentEvent, type AdjustmentEvent } from './showcase-refund-policy';
import { readSettlementCaptureDetails, readSettlementRefundProof, verifySettlementAdjustment } from './settlement-paypal-proof';
import { checkoutMoney, checkoutPaymentBinding } from './checkout-money';

export function createPayPalAdjustmentReconciler(db: PrismaClient, provider = { readPayPalCapture, readPayPalRefund }) {
  /** The route MUST verify the exact webhook signature before calling this.
   * Browser returns/checkout bodies have no route to this method. */
  return async function reconcileVerifiedEvent(input: AdjustmentEvent) {
    const event = PayPalAdjustmentEvent.parse(input);
    const environment = paypalEnvironment().mode, eventProvider = `PAYPAL_${environment}`;
    const delivery = { provider: eventProvider, deliveryId: event.id };
    if (await db.paymentWebhookEvent.findUnique({ where: { provider_deliveryId: delivery }, select: { id: true } })) return { duplicate: true };
    const refund = event.event_type === 'PAYMENT.CAPTURE.REFUNDED'
      ? readSettlementRefundProof(await provider.readPayPalRefund(event.resource.id), event.resource.id, environment) : undefined;
    const captureId = refund?.captureId ?? event.resource.id;
    const capture = readSettlementCaptureDetails(await provider.readPayPalCapture(captureId));
    const attempt = await db.checkoutAttempt.findUnique({ where: { paypalOrderId: capture.supplementary_data.related_ids.order_id } });
    if (!attempt) return { ignored: true }; // Not this app's server-priced checkout.
    if (attempt.environment !== environment) throw new CheckoutError('WRONG_PAYMENT_ENVIRONMENT', 409);
    verifySettlementAdjustment(capture, { ...checkoutPaymentBinding(attempt), captureId: attempt.captureId }, captureId, refund);

    return db.$transaction(async tx => {
      // Same lock as verified fulfillment: refund-before-completion and duplicate
      // events cannot grant/revoke simultaneously or revive a cancelled order.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`fulfill:${attempt.orderId}`}, 0))`;
      if (await tx.paymentWebhookEvent.findUnique({ where: { provider_deliveryId: delivery }, select: { id: true } })) return { duplicate: true };
      const fresh = await tx.checkoutAttempt.findUniqueOrThrow({ where: { orderId: attempt.orderId } });
      if (fresh.environment !== environment) throw new CheckoutError('WRONG_PAYMENT_ENVIRONMENT', 409);
      const pricing = checkoutMoney(fresh);
      const proof = verifySettlementAdjustment(capture, { ...checkoutPaymentBinding(fresh), captureId: fresh.captureId }, captureId, refund);
      const terminal = fresh.state === 'REFUNDED' || fresh.state === 'REVERSED';
      const state = terminal ? fresh.state : proof.state;
      const sourceKey = `paypal-revoke:${fresh.orderId}`;
      const prior = await tx.aiCreditEntry.findUnique({ where: { sourceKey } });
      const purchase = await tx.aiCreditEntry.findUnique({ where: { sourceKey: `checkout:${fresh.orderId}` } });
      if (purchase && !prior) {
        const accountId = `${environment}:${fresh.userId}`;
        if (purchase.kind !== 'PURCHASE' || purchase.accountId !== accountId || purchase.delta <= 0) throw new CheckoutError('CREDIT_PURCHASE_PROOF_INVALID', 409);
        await applyAiCreditDelta(tx, accountId, -purchase.delta);
        await tx.aiCreditEntry.create({ data: { accountId, delta: -purchase.delta, kind: 'PAYMENT_REVERSAL', sourceKey } });
      }
      const now = new Date();
      await tx.checkoutAttempt.update({ where: { orderId: fresh.orderId }, data: {
        state, captureId,
        ...(pricing.version === 'exact' ? { refundedMinor: Math.max(pricing.refundedMinor, proof.money.minor) } :
          { refundedOre: Math.max(pricing.refundedMinor, proof.money.minor) }),
        refundReference: terminal ? fresh.refundReference ?? proof.reference : proof.reference,
        paymentAdjustedAt: now,
      }, select: { orderId: true } });
      await tx.downloadToken.updateMany({ where: { orderId: fresh.orderId, isRevoked: false },
        data: { isRevoked: true, revokedReason: state === 'PAYMENT_REVIEW' ? 'Partial payment refund: access held for review' : 'Payment refunded or reversed' } });
      await tx.order.update({ where: { id: fresh.orderId },
        data: { status: state === 'PAYMENT_REVIEW' ? 'CONFIRMING' : 'CANCELLED' }, select: { id: true } });
      // Minimal proof only: no payer identities, raw webhook body or auth headers.
      await tx.paymentWebhookEvent.create({ data: { ...delivery, eventType: event.event_type, signatureVerified: true,
        orderId: fresh.orderId, orderStatus: state, httpStatus: 200,
        rawPayload: { captureId, reference: proof.reference, amountMinor: proof.money.minor, currency: proof.money.currency },
      }, select: { id: true } });
      return { orderId: fresh.orderId, state };
    }, { maxWait: 10_000, timeout: 15_000 });
  };
}

export const reconcilePayPalAdjustment = createPayPalAdjustmentReconciler(dbPrisma as PrismaClient);
