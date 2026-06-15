import { NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { getPaymentProvider, type PaymentProviderType } from '@/lib/payments/providers';
import { verifyWebhookSignature } from '@/lib/payments/webhook-verify';
import { getProviderGate } from '@/lib/payments/provider-gating';
import { getRuntimeConfig } from '@/lib/runtime-config';

function selectWebhookHeaders(headers: Headers): Record<string, string> {
  const keep = [
    'paypal-transmission-id',
    'paypal-transmission-time',
    'paypal-cert-url',
    'paypal-auth-algo',
    'x-klarna-hmac-sha256',
    'authorization',
    'x-forwarded-for',
    'user-agent',
  ];

  const result: Record<string, string> = {};
  for (const key of keep) {
    const value = headers.get(key);
    if (value) result[key] = value;
  }
  return result;
}

async function logWebhookEvent(input: {
  provider: string;
  eventType?: string | null;
  deliveryId?: string | null;
  signatureVerified: boolean;
  sessionId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  paymentStatus?: string | null;
  orderStatus?: string | null;
  httpStatus?: number | null;
  processingError?: string | null;
  rawPayload?: unknown;
  headers?: Record<string, string>;
}) {
  try {
    const deliveryId = input.deliveryId?.trim() || null;
    const eventData = {
      provider: input.provider,
      eventType: input.eventType ?? null,
      deliveryId,
      signatureVerified: input.signatureVerified,
      sessionId: input.sessionId ?? null,
      orderId: input.orderId ?? null,
      paymentId: input.paymentId ?? null,
      paymentStatus: input.paymentStatus ?? null,
      orderStatus: input.orderStatus ?? null,
      httpStatus: input.httpStatus ?? null,
      processingError: input.processingError ?? null,
      rawPayload: input.rawPayload ? JSON.parse(JSON.stringify(input.rawPayload)) : null,
      headers: input.headers ? JSON.parse(JSON.stringify(input.headers)) : null,
    };

    if (deliveryId) {
      await dbPrisma.paymentWebhookEvent.upsert({
        where: { provider_deliveryId: { provider: input.provider, deliveryId } },
        create: eventData,
        update: eventData,
      });
      return;
    }

    await dbPrisma.paymentWebhookEvent.create({ data: eventData });
  } catch (error) {
    console.error(`[webhook/${input.provider}] Failed to persist webhook event:`, error);
  }
}

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
    const headersForLog = selectWebhookHeaders(req.headers);
    let parsedBody: any = null;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }

    const eventType = parsedBody?.event_type || parsedBody?.eventType || parsedBody?.type || null;
    const deliveryId = req.headers.get('paypal-transmission-id') || req.headers.get('x-klarna-request-id');

    // ── Signature verification (production-enforced) ──
    const isVerified = await verifyWebhookSignature(providerType, rawBody, req.headers);
    if (!isVerified) {
      await logWebhookEvent({
        provider: providerType,
        eventType,
        deliveryId,
        signatureVerified: false,
        httpStatus: 401,
        processingError: 'Invalid signature',
        rawPayload: parsedBody,
        headers: headersForLog,
      });
      console.error(`[webhook/${providerType}] Signature verification FAILED from IP: ${ip}`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = parsedBody || JSON.parse(rawBody);

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
      await logWebhookEvent({
        provider: providerType,
        eventType,
        deliveryId,
        signatureVerified: true,
        httpStatus: 200,
        processingError: 'Missing session/reference ID',
        rawPayload: body,
        headers: headersForLog,
      });
      console.error(`[webhook/${providerType}] Could not extract session ID from body`);
      return NextResponse.json({ received: true });
    }

    // Check payment status with provider
    const status = await provider.getStatus(sessionId);

    if (status.status === 'CAPTURED' || status.status === 'AUTHORIZED') {
      // Extract orderId: Vipps uses "order-{orderId}-{timestamp}" format, 
      // PayPal uses its own ID but stores our orderId in purchase_units[0].reference_id
      let orderId: string | undefined;
      
      if (providerType === 'paypal') {
        // PayPal: extract from purchase_units reference_id or look up by transactionId
        orderId = body.resource?.purchase_units?.[0]?.reference_id;
        if (!orderId) {
          // Fallback: find payment by PayPal order ID stored as transactionId
          const payment = await dbPrisma.payment.findFirst({
            where: { transactionId: sessionId },
            select: { orderId: true },
          });
          orderId = payment?.orderId ?? undefined;
        }
      } else {
        // Vipps/Klarna: parse from reference format "order-{orderId}-{timestamp}"
        const orderIdMatch = sessionId.match(/^order-(.+?)-\d+$/);
        orderId = orderIdMatch?.[1];
      }

      if (orderId) {
        // Use the shared completeFiatOrder function for consistent post-payment logic
        const { completeFiatOrder } = await import('@/lib/payments/complete-fiat-order');
        const result = await completeFiatOrder(orderId, {
          paymentTransactionId: status.transactionId ?? sessionId,
          source: `webhook-${providerType}`,
        });

        console.log(`[webhook/${providerType}] Order ${orderId} completion: ${result.success ? 'ok' : result.error}${result.alreadyCompleted ? ' (already completed)' : ''}`);

        const payment = await dbPrisma.payment.findUnique({ where: { orderId }, select: { id: true, status: true } });
        const orderNow = await dbPrisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
        await logWebhookEvent({
          provider: providerType,
          eventType,
          deliveryId,
          signatureVerified: true,
          sessionId,
          orderId,
          paymentId: payment?.id ?? null,
          paymentStatus: payment?.status ?? null,
          orderStatus: orderNow?.status ?? null,
          httpStatus: 200,
          rawPayload: body,
          headers: headersForLog,
        });
      }
    }

    if (status.status === 'CANCELLED' || status.status === 'FAILED') {
      // Same lookup logic as above
      let orderId: string | undefined;
      if (providerType === 'paypal') {
        orderId = body.resource?.purchase_units?.[0]?.reference_id;
        if (!orderId) {
          const payment = await dbPrisma.payment.findFirst({
            where: { transactionId: sessionId },
            select: { orderId: true },
          });
          orderId = payment?.orderId ?? undefined;
        }
      } else {
        const orderIdMatch = sessionId.match(/^order-(.+?)-\d+$/);
        orderId = orderIdMatch?.[1];
      }

      if (orderId) {
        const existingOrder = await dbPrisma.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        });

        // Never downgrade a completed order from late/out-of-order webhook delivery.
        if (existingOrder && existingOrder.status !== 'COMPLETED') {
          await dbPrisma.$transaction([
            dbPrisma.order.update({
              where: { id: orderId },
              data: {
                status: 'FAILED',
                transactionId: status.transactionId ?? sessionId,
              },
            }),
            dbPrisma.payment.update({
              where: { orderId },
              data: {
                status: 'FAILED',
                transactionId: status.transactionId ?? sessionId,
              },
            }),
          ]);

          console.log(`[webhook/${providerType}] Order ${orderId} marked FAILED via ${providerType}`);

          const payment = await dbPrisma.payment.findUnique({ where: { orderId }, select: { id: true, status: true } });
          const orderNow = await dbPrisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
          await logWebhookEvent({
            provider: providerType,
            eventType,
            deliveryId,
            signatureVerified: true,
            sessionId,
            orderId,
            paymentId: payment?.id ?? null,
            paymentStatus: payment?.status ?? null,
            orderStatus: orderNow?.status ?? null,
            httpStatus: 200,
            rawPayload: body,
            headers: headersForLog,
          });
        }
      }
    }

    if (status.status !== 'CAPTURED' && status.status !== 'AUTHORIZED' && status.status !== 'CANCELLED' && status.status !== 'FAILED') {
      // Resolve orderId for logging
      let orderId: string | null = null;
      if (providerType === 'paypal') {
        orderId = body.resource?.purchase_units?.[0]?.reference_id ?? null;
      } else {
        const m = sessionId.match(/^order-(.+?)-\d+$/);
        orderId = m?.[1] ?? null;
      }
      const payment = orderId ? await dbPrisma.payment.findUnique({ where: { orderId }, select: { id: true, status: true } }) : null;
      const orderNow = orderId ? await dbPrisma.order.findUnique({ where: { id: orderId }, select: { status: true } }) : null;
      await logWebhookEvent({
        provider: providerType,
        eventType,
        deliveryId,
        signatureVerified: true,
        sessionId,
        orderId,
        paymentId: payment?.id ?? null,
        paymentStatus: payment?.status ?? null,
        orderStatus: orderNow?.status ?? null,
        httpStatus: 200,
        rawPayload: body,
        headers: headersForLog,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    try {
      const message = error instanceof Error ? error.message : 'Webhook processing error';
      await logWebhookEvent({
        provider: providerType,
        signatureVerified: false,
        httpStatus: 500,
        processingError: message,
      });
    } catch {
      // ignore secondary logging errors
    }
    console.error(`[webhook/${providerType}] Error:`, error);
    return NextResponse.json({ received: true }); // Always 200 for webhooks
  }
}
