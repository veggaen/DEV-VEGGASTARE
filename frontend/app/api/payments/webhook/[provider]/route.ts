import { NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { getPaymentProvider, type PaymentProviderType } from '@/lib/payments/providers';
import { recalculateVerificationTier } from '@/lib/verification-recalc';

/**
 * POST /api/payments/webhook/[provider]
 * Handle payment provider webhooks (Vipps, Klarna, PayPal)
 *
 * SECURITY NOTE: In production, each provider's webhook signature MUST be
 * verified before processing. Currently validates provider status via API call
 * (getStatus) as a secondary check, but the webhook payload itself is not
 * signature-verified.
 *
 * TODO (before accepting real payments):
 * - Vipps: Verify Authorization header with webhook secret
 * - Klarna: Verify X-Klarna-Hmac-Sha256 header
 * - PayPal: Verify PAYPAL-TRANSMISSION-SIG with PayPal cert
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerType } = await params;

  const provider = getPaymentProvider(providerType as PaymentProviderType);
  if (!provider) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }

  // SECURITY: Log webhook source for audit trail
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  console.log(`[webhook/${providerType}] Received from IP: ${ip}`);

  try {
    const body = await req.json();

    // Extract session/reference ID based on provider
    let sessionId: string | undefined;
    switch (providerType) {
      case 'vipps':
        sessionId = body.reference;
        break;
      case 'klarna':
        sessionId = body.session_id ?? body.order_id;
        break;
      case 'paypal':
        sessionId = body.resource?.id;
        break;
    }

    if (!sessionId) {
      console.error(`[webhook/${providerType}] Could not extract session ID from body`);
      return NextResponse.json({ received: true });
    }

    // Check payment status with provider
    const status = await provider.getStatus(sessionId);

    if (status.status === 'CAPTURED' || status.status === 'AUTHORIZED') {
      // Find order by looking at Payment records with this transactionId
      // Or parse orderId from the reference (e.g., "order-{orderId}-{timestamp}")
      const orderIdMatch = sessionId.match(/^order-(.+?)-\d+$/);
      const orderId = orderIdMatch?.[1];

      if (orderId) {
        await dbPrisma.$transaction([
          dbPrisma.order.update({
            where: { id: orderId },
            data: { status: 'COMPLETED', transactionId: status.transactionId ?? sessionId },
          }),
          dbPrisma.payment.update({
            where: { orderId },
            data: {
              status: 'COMPLETED',
              transactionId: status.transactionId ?? sessionId,
            },
          }),
        ]);

        console.log(`[webhook/${providerType}] Order ${orderId} completed via ${providerType}`);

        // Set Web2 payment flag and recalculate verification tier
        const order = await dbPrisma.order.findUnique({ where: { id: orderId }, select: { userId: true } });
        if (order?.userId) {
          try {
            await dbPrisma.user.update({
              where: { id: order.userId },
              data: { hasWeb2Payment: true },
            });
            await recalculateVerificationTier(order.userId, { hasWeb2Payment: true });
          } catch (flagErr) {
            console.error(`[webhook/${providerType}] Failed to set hasWeb2Payment:`, flagErr);
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[webhook/${providerType}] Error:`, error);
    return NextResponse.json({ received: true }); // Always 200 for webhooks
  }
}
