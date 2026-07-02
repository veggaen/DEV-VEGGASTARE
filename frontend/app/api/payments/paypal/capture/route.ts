/**
 * @fileOverview  PayPal capture endpoint — called when buyer returns from PayPal approval.
 * @stability     stable
 *
 * Flow:
 *   1. PayPal redirects buyer to /api/payments/paypal/capture?token=PAYPAL_ORDER_ID&orderId=INTERNAL_ORDER_ID
 *   2. We call capturePayment(token) to finalize the charge
 *   3. On success → completeFiatOrder() does all post-payment logic
 *   4. Redirect to /order-confirmation?orderId={orderId}
 *
 * On failure or cancellation → redirect to /order-confirmation?orderId={orderId}&paymentFailed=true
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { getPaymentProvider } from '@/lib/payments/providers';
import { completeFiatOrder, releaseReservedOrderStock } from '@/lib/payments/complete-fiat-order';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token'); // PayPal Order ID
  const orderId = url.searchParams.get('orderId');
  const cancelled = url.searchParams.get('cancelled');
  const origin = url.origin;

  // Verify user session
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${origin}/auth/login?callbackUrl=/order-confirmation?orderId=${orderId}`);
  }

  // Handle cancellation. PayPal cancel URLs do not always include a token.
  if (cancelled === 'true' && orderId) {
    const order = await dbPrisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, status: true },
    });

    if (order?.userId === session.user.id && order.status !== 'COMPLETED') {
      await releaseReservedOrderStock(orderId, {
        status: 'CANCELLED',
        source: 'paypal-cancel',
      });
    }

    console.log(`[paypal-capture] Payment cancelled for order ${orderId}`);
    return NextResponse.redirect(`${origin}/order-confirmation?orderId=${orderId}&paymentCancelled=true`);
  }

  if (!token || !orderId) {
    console.error('[paypal-capture] Missing token or orderId');
    return NextResponse.redirect(`${origin}/checkout?error=missing_payment_params`);
  }

  // Verify order belongs to user
  const order = await dbPrisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, status: true },
  });

  if (!order) {
    console.error(`[paypal-capture] Order not found: ${orderId}`);
    return NextResponse.redirect(`${origin}/checkout?error=order_not_found`);
  }

  if (order.userId !== session.user.id) {
    console.error(`[paypal-capture] Order ${orderId} doesn't belong to user ${session.user.id}`);
    return NextResponse.redirect(`${origin}/checkout?error=unauthorized`);
  }

  // Already completed (idempotent)
  if (order.status === 'COMPLETED') {
    return NextResponse.redirect(`${origin}/order-confirmation?orderId=${orderId}`);
  }

  // Capture payment with PayPal
  const paypal = getPaymentProvider('paypal');
  if (!paypal || !('capturePayment' in paypal)) {
    console.error('[paypal-capture] PayPal provider not available');
    await releaseReservedOrderStock(orderId, {
      status: 'FAILED',
      source: 'paypal-provider-unavailable',
    });
    return NextResponse.redirect(`${origin}/order-confirmation?orderId=${orderId}&paymentFailed=true`);
  }

  try {
    const captureResult = await (paypal as any).capturePayment(token);

    if (captureResult.status !== 'CAPTURED') {
      console.error(`[paypal-capture] Capture returned status: ${captureResult.status}`);
      await releaseReservedOrderStock(orderId, {
        status: captureResult.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
        paymentTransactionId: captureResult.transactionId ?? token,
        source: 'paypal-capture-not-captured',
      });
      return NextResponse.redirect(
        `${origin}/order-confirmation?orderId=${orderId}&paymentFailed=true`
      );
    }

    // Complete the order (all side effects: email, tokens, repo access, etc.)
    const result = await completeFiatOrder(orderId, {
      paymentTransactionId: captureResult.transactionId ?? token,
      origin,
      source: 'paypal-capture',
    });

    if (!result.success) {
      console.error(`[paypal-capture] completeFiatOrder failed:`, result.error);
      // Payment was captured but order completion failed — still redirect to confirmation
      // The webhook will retry completion, or admin can manually fix
    }

    // Clear cart via API (best-effort)
    try {
      const cartRes = await fetch(`${origin}/api/cart/${session.user.id}`, { method: 'DELETE' });
      if (!cartRes.ok) console.warn('[paypal-capture] Cart clear failed:', cartRes.status);
    } catch {
      // Non-critical
    }

    return NextResponse.redirect(`${origin}/order-confirmation?orderId=${orderId}`);
  } catch (err) {
    console.error('[paypal-capture] Capture failed:', err);
    return NextResponse.redirect(
      `${origin}/order-confirmation?orderId=${orderId}&paymentFailed=true`
    );
  }
}
