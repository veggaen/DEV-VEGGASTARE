import { NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { getPaymentProvider, type PaymentProviderType } from '@/lib/payments/providers';
import { recalculateVerificationTier } from '@/lib/verification-recalc';
import { verifyWebhookSignature } from '@/lib/payments/webhook-verify';
import { getProviderGate } from '@/lib/payments/provider-gating';
import { getRuntimeConfig } from '@/lib/runtime-config';

/**
 * POST /api/payments/webhook/[provider]
 * Handle payment provider webhooks (Vipps, Klarna, PayPal)
 *
 * SECURITY: Webhook signatures are verified per-provider before processing.
 * - Vipps: Authorization header matched against VIPPS_WEBHOOK_SECRET
 * - Klarna: HMAC-SHA256 via X-Klarna-Hmac-Sha256 header
 * - PayPal: Certificate-based verification via PayPal API (PAYPAL-TRANSMISSION-SIG)
 * In development, verification is skipped with a warning.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerType } = await params;

  if (providerType !== 'vipps' && providerType !== 'klarna' && providerType !== 'paypal') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }

  const typedProvider: PaymentProviderType = providerType;

  const runtime = await getRuntimeConfig();
  const gate = getProviderGate(typedProvider, runtime);
  if (!gate.enabled) {
    return NextResponse.json({ error: gate.reason ?? 'Provider disabled' }, { status: 503 });
  }

  const provider = getPaymentProvider(typedProvider);
  if (!provider) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }

  // SECURITY: Log webhook source for audit trail
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  console.log(`[webhook/${providerType}] Received from IP: ${ip}`);

  try {
    // Read raw body for signature verification, then parse JSON
    const rawBody = await req.text();

    // ── Signature verification (production-enforced) ──
    const isVerified = await verifyWebhookSignature(providerType, rawBody, req.headers);
    if (!isVerified) {
      console.error(`[webhook/${providerType}] Signature verification FAILED from IP: ${ip}`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

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
