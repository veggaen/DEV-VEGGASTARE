/**
 * @fileOverview Buyer return request API — initiate and view return requests.
 * @stability experimental
 *
 * POST /api/returns — Create a new return request (buyer)
 * GET  /api/returns — List buyer's own return requests
 *
 * Accepts requests for review; timing alone does not decide legal eligibility.
 * Download/use does not remove defect claims or payment-provider dispute rights.
 */

import { dbPrisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { CreateReturnSchema } from '@/lib/payments/return-request';
import { BuyerRequestError, createBuyerRequest } from '@/lib/payments/create-return-request';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

// ─── POST: Create Return Request ──────────────────────────────

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Use return requests from this site' }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!await allowAuthAttempt('return-request', session.user.id, request)) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
  }

  // Rate limiting
  const identifier = getClientIdentifier(request, session.user.id);
  const rateLimitResult = await checkRateLimit(identifier, 'write');
  if (!rateLimitResult.success) {
    return rateLimitedResponse(rateLimitResult);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateReturnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', ...(isDev ? { issues: parsed.error.issues } : {}) },
      { status: 400 },
    );
  }

  try {
    const { record: returnRequest, duplicate, order } = await createBuyerRequest(dbPrisma, session.user.id, parsed.data);

    // Display a timing hint only. Never auto-reject a defect request based on
    // elapsed days, a download counter, or an unrecorded withdrawal waiver.
    const referenceDate = order.deliveredAt ?? order.createdAt;
    const daysSinceRef = Math.floor(
      (Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    return NextResponse.json({
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      reason: returnRequest.reason,
      status: returnRequest.status,
      description: returnRequest.description,
      sellerNote: returnRequest.sellerNote,
      createdAt: toIsoString(returnRequest.createdAt),
      duplicate,
      withinWithdrawalPeriod: daysSinceRef <= 14,
      daysSinceDelivery: daysSinceRef,
    }, { status: duplicate ? 200 : 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof BuyerRequestError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } });
    console.error('[api/returns] Return request unavailable');
    return NextResponse.json(
      { error: 'Failed to create return request' },
      { status: 500 },
    );
  }
}

// ─── GET: List Buyer's Return Requests ────────────────────────

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const identifier = getClientIdentifier(request, session.user.id);
  const rateLimitResult = await checkRateLimit(identifier, 'read');
  if (!rateLimitResult.success) {
    return rateLimitedResponse(rateLimitResult);
  }

  try {
    const returnRequests = await dbPrisma.returnRequest.findMany({
      where: { userId: session.user.id },
      include: {
        Order: {
          select: {
            id: true,
            totalAmount: true,
            createdAt: true,
            fulfilmentStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const dto = returnRequests.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      reason: r.reason,
      description: r.description,
      status: r.status,
      sellerNote: r.sellerNote,
      refundAmount: r.refundAmount,
      processedAt: r.processedAt ? toIsoString(r.processedAt) : null,
      createdAt: toIsoString(r.createdAt),
      order: {
        id: r.Order.id,
        totalAmount: r.Order.totalAmount,
        createdAt: toIsoString(r.Order.createdAt),
        fulfilmentStatus: r.Order.fulfilmentStatus,
      },
    }));

    return NextResponse.json(dto, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    console.error('[api/returns] Return list unavailable');
    return NextResponse.json(
      { error: 'Failed to fetch return requests' },
      { status: 500 },
    );
  }
}
