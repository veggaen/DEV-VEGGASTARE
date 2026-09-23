/** @fileOverview Verified PayPal events reconcile server-bound checkout attempts. @stability experimental */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dbPrisma } from '@/lib/db';
import { verifyPayPalWebhook } from '@/lib/payments/webhook-verify';
import { completeShowcaseCheckout } from '@/lib/payments/showcase-store';

const Event = z.object({ id: z.string().max(128), event_type: z.string().max(128), resource: z.object({
  supplementary_data: z.object({ related_ids: z.object({ order_id: z.string().regex(/^[A-Z0-9]{1,36}$/) }) }).optional(),
}).passthrough() }).passthrough();

export async function POST(request: Request) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 65_536) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  try {
    const event = Event.safeParse(JSON.parse(raw));
    if (!event.success) return NextResponse.json({ error: 'INVALID_EVENT' }, { status: 400 });
    if (!await verifyPayPalWebhook(raw, request.headers)) return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
    if (event.data.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return NextResponse.json({ received: true, ignored: true });
    const paypalOrderId = event.data.resource.supplementary_data?.related_ids.order_id;
    if (!paypalOrderId) return NextResponse.json({ error: 'MISSING_ORDER_REFERENCE' }, { status: 400 });
    const attempt = await dbPrisma.checkoutAttempt.findUnique({ where: { paypalOrderId } });
    if (!attempt) return NextResponse.json({ received: true, ignored: true });
    // Fetch fresh PayPal proof. Webhook JSON never directly grants entitlements.
    await completeShowcaseCheckout(attempt.orderId, attempt.userId, false);
    return NextResponse.json({ received: true });
  } catch {
    // Acknowledge only completed processing so PayPal can retry transient failures.
    return NextResponse.json({ error: 'RECONCILIATION_FAILED' }, { status: 503 });
  }
}
