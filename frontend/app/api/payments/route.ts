import { NextResponse } from 'next/server';
import { MyLibUserAuth } from '@/lib/user-auth';
import { dbPrisma } from '@/lib/db';
import { getPaymentProvider, getAvailablePaymentMethods } from '@/lib/payments/providers';
import { getProviderGate } from '@/lib/payments/provider-gating';
import { getRuntimeConfig } from '@/lib/runtime-config';
import { z } from 'zod';
import { parseJsonOrError } from '@/lib/api-validate';

/**
 * GET /api/payments/methods
 * List available payment methods
 */
export async function GET() {
  const runtime = await getRuntimeConfig();
  const methods = getAvailablePaymentMethods().filter((method) => {
    if (method.type === 'crypto') return true;
    return getProviderGate(method.type, runtime).enabled;
  });
  return NextResponse.json({ methods });
}

const CreatePaymentSchema = z.object({
  provider: z.enum(['vipps', 'klarna', 'paypal']),
  orderId: z.string().min(1),
  amount: z.coerce.number().int().positive(), // In smallest unit (øre/cents)
  currency: z.string().length(3).default('NOK'),
  description: z.string().max(200).default('VeggaStare Order'),
  returnUrl: z.string().url(),
  // Seller's verified PayPal email — for P2P PayPal payments to seller
  sellerPaypalEmail: z.string().email().max(254).optional().nullable(),
});

/**
 * POST /api/payments/create-session
 * Create a payment session with a specific provider
 */
export async function POST(req: Request) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bodyResult = await parseJsonOrError(req, CreatePaymentSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { provider: providerType, orderId, amount, returnUrl } = bodyResult.data;
  const runtime = await getRuntimeConfig();
  const currency = bodyResult.data.currency ?? 'NOK';
  const description = bodyResult.data.description ?? 'VeggaStare Order';

  const gate = getProviderGate(providerType, runtime);
  if (!gate.enabled) {
    return NextResponse.json(
      { error: gate.reason ?? `${providerType} is currently unavailable` },
      { status: 503 }
    );
  }

  // Verify order exists and belongs to user
  const order = await dbPrisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, status: true },
  });

  if (!order || order.userId !== session.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.status === 'COMPLETED') {
    return NextResponse.json({ error: 'Order already completed' }, { status: 400 });
  }

  const provider = getPaymentProvider(providerType);
  if (!provider) {
    return NextResponse.json({ error: `Payment provider ${providerType} not available` }, { status: 400 });
  }

  try {
    const origin = new URL(req.url).origin;
    const paymentSession = await provider.createSession({
      orderId,
      amount,
      currency,
      description,
      customerEmail: session.email ?? undefined,
      returnUrl,
      callbackUrl: `${origin}/api/payments/webhook/${providerType}`,
      // Forward seller PayPal email for P2P routing
      ...(bodyResult.data.sellerPaypalEmail
        ? { sellerEmail: bodyResult.data.sellerPaypalEmail }
        : {}),
    });

    return NextResponse.json(paymentSession);
  } catch (error) {
    console.error(`[payments] ${providerType} session creation failed:`, error);
    return NextResponse.json(
      { error: 'Failed to create payment session' },
      { status: 500 }
    );
  }
}
