import { NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { getPaymentProvider, type PaymentProviderType } from '@/lib/payments/providers';

/**
 * POST /api/payments/webhook/[provider]
 * Handle payment provider webhooks (Vipps, Klarna, PayPal)
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
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[webhook/${providerType}] Error:`, error);
    return NextResponse.json({ received: true }); // Always 200 for webhooks
  }
}
