/**
 * @fileOverview Buyer return request API — initiate and view return requests.
 * @stability experimental
 *
 * POST /api/returns — Create a new return request (buyer)
 * GET  /api/returns — List buyer's own return requests
 *
 * Norwegian Angrerettloven compliance: buyers have 14-day unconditional withdrawal right
 * from delivery date for physical goods, and from purchase date for digital goods.
 */

import { dbPrisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { z } from 'zod';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

// ─── POST: Create Return Request ──────────────────────────────

const CreateReturnSchema = z.object({
  orderId: z.string().min(1),
  reason: z.enum(['CHANGED_MIND', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'LATE_DELIVERY', 'OTHER']),
  description: z.string().trim().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  const { orderId, reason, description } = parsed.data;

  try {
    // Verify the order belongs to this buyer
    const order = await dbPrisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        fulfilmentStatus: true,
        createdAt: true,
        deliveredAt: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate order is in a returnable state
    if (order.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Only completed orders can be returned' },
        { status: 400 },
      );
    }

    if (['RETURNED', 'CANCELLED'].includes(order.fulfilmentStatus)) {
      return NextResponse.json(
        { error: 'Order already returned or cancelled' },
        { status: 400 },
      );
    }

    // Check if a return request already exists
    const existingReturn = await dbPrisma.returnRequest.findFirst({
      where: {
        orderId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (existingReturn) {
      return NextResponse.json(
        { error: 'A return request already exists for this order' },
        { status: 409 },
      );
    }

    // Check 14-day window (Angrerettloven)
    const referenceDate = order.deliveredAt ?? order.createdAt;
    const daysSinceRef = Math.floor(
      (Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Create return request
    const returnRequest = await dbPrisma.returnRequest.create({
      data: {
        orderId,
        userId: session.user.id,
        reason,
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      reason: returnRequest.reason,
      status: returnRequest.status,
      createdAt: toIsoString(returnRequest.createdAt),
      withinWithdrawalPeriod: daysSinceRef <= 14,
      daysSinceDelivery: daysSinceRef,
    }, { status: 201 });
  } catch (error) {
    console.error('[api/returns] Error creating return request:', error);
    return NextResponse.json(
      { error: 'Failed to create return request', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
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

    return NextResponse.json(dto);
  } catch (error) {
    console.error('[api/returns] Error fetching return requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch return requests' },
      { status: 500 },
    );
  }
}
