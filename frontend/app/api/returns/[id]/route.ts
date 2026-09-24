/**
 * @fileOverview Seller return request processing API.
 * @stability experimental
 *
 * PATCH /api/returns/[id] — Process a return request (approve/reject/refund)
 *
 * Review only. Payment-provider reconciliation, never this endpoint, confirms money returned.
 */

import { dbPrisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { z } from 'zod';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

type RouteContext = { params: Promise<{ id: string }> };

const ProcessReturnSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REFUND', 'CANCEL']),
  sellerNote: z.string().trim().max(2000).optional(),
}).strict();

type ReturnItem = { Product: { userId: string | null; companyId: string | null } };

async function canReviewWholeOrder(userId: string, role: string | undefined, items: ReturnItem[]) {
  // A return currently covers the entire order. One seller must not see or
  // decide another seller's lines. Empty orders fail closed, including for admins.
  if (!items.length) return false;
  if (role === 'ADMIN') return true;
  const companyIds = [...new Set(items.filter(item => item.Product.userId !== userId)
    .map(item => item.Product.companyId).filter((id): id is string => !!id))];
  const employees = companyIds.length ? await dbPrisma.employee.findMany({
    where: { userId, companyId: { in: companyIds }, role: { in: ['OWNER', 'MANAGER'] } },
    select: { companyId: true },
  }) : [];
  const managedCompanies = new Set(employees.map(employee => employee.companyId));
  return items.every(({ Product: product }) => product.userId === userId ||
    (product.companyId !== null && managedCompanies.has(product.companyId)));
}

class ReturnReviewConflict extends Error {}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Use return requests from this site' }, { status: 403 });
  }
  const session = await auth();
  const sessionUserId = session?.user?.id;
  const sessionUserRole = session?.user?.role;
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!await allowAuthAttempt('return-review', sessionUserId, request)) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Return request ID required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ProcessReturnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', ...(isDev ? { issues: parsed.error.issues } : {}) },
      { status: 400 },
    );
  }

  const { action, sellerNote } = parsed.data;

  try {
    // Fetch the return request with order and product info
    const returnReq = await dbPrisma.returnRequest.findUnique({
      where: { id },
      include: {
        Order: {
          include: {
            OrderItem: {
              include: {
                Product: { select: { id: true, userId: true, companyId: true } },
              },
            },
          },
        },
      },
    });

    if (!returnReq) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 });
    }

    if (!await canReviewWholeOrder(sessionUserId, sessionUserRole, returnReq.Order.OrderItem)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'REFUND') {
      // An admin click, amount, approval or download count is not proof that
      // money moved. Verified PayPal events revoke entitlements separately.
      return NextResponse.json({
        error: 'Refunds must be completed through the payment provider. Approval here does not send money.',
        code: 'REFUND_REQUIRES_VERIFIED_PAYMENT',
      }, { status: 409 });
    }

    // Validate state transition
    const validTransitions: Record<string, string[]> = {
      PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['CANCELLED'],
    };

    const statusMap: Record<string, string> = {
      APPROVE: 'APPROVED',
      REJECT: 'REJECTED',
      CANCEL: 'CANCELLED',
    };

    const newStatus = statusMap[action];
    const allowed = validTransitions[returnReq.status];
    if (!allowed || !allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot ${action} a return request in ${returnReq.status} status` },
        { status: 400 },
      );
    }

    // Process the return
    const updated = await dbPrisma.$transaction(async (tx) => {
      const changed = await tx.returnRequest.updateMany({
        where: { id, status: returnReq.status, updatedAt: returnReq.updatedAt },
        data: {
          status: newStatus as 'APPROVED' | 'REJECTED' | 'CANCELLED',
          sellerNote: sellerNote?.trim() || returnReq.sellerNote,
          processedBy: sessionUserId,
          processedAt: new Date(),
        },
      });

      if (changed.count !== 1) throw new ReturnReviewConflict();
      return tx.returnRequest.findUniqueOrThrow({ where: { id } });
    });

    return NextResponse.json({
      id: updated.id,
      orderId: updated.orderId,
      status: updated.status,
      sellerNote: updated.sellerNote,
      refundAmount: updated.refundAmount,
      processedAt: updated.processedAt ? toIsoString(updated.processedAt) : null,
      updatedAt: toIsoString(updated.updatedAt),
    });
  } catch (error) {
    if (error instanceof ReturnReviewConflict) {
      return NextResponse.json({ error: 'This request changed. Refresh before reviewing it again.' }, { status: 409 });
    }
    console.error('[api/returns/[id]] Return review unavailable');
    return NextResponse.json(
      { error: 'Failed to process return request' },
      { status: 500 },
    );
  }
}

// GET: Fetch a single return request details
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();
  const sessionUserId = session?.user?.id;
  const sessionUserRole = session?.user?.role;
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const limit = await checkRateLimit(getClientIdentifier(request, sessionUserId), 'read');
  if (!limit.success) return rateLimitedResponse(limit);

  const { id } = await context.params;

  try {
    const returnReq = await dbPrisma.returnRequest.findUnique({
      where: { id },
      include: {
        Order: {
          select: {
            id: true,
            totalAmount: true,
            createdAt: true,
            userId: true,
            fulfilmentStatus: true,
            OrderItem: {
              select: {
                id: true,
                title: true,
                quantity: true,
                priceAtTime: true,
                Product: {
                  select: { userId: true, companyId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!returnReq) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 });
    }

    // Do not disclose the full mixed-seller order to one of its sellers.
    const isBuyer = returnReq.userId === sessionUserId;
    if (!isBuyer && !await canReviewWholeOrder(sessionUserId, sessionUserRole, returnReq.Order.OrderItem)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      id: returnReq.id,
      orderId: returnReq.orderId,
      reason: returnReq.reason,
      description: returnReq.description,
      status: returnReq.status,
      sellerNote: returnReq.sellerNote,
      refundAmount: returnReq.refundAmount,
      processedAt: returnReq.processedAt ? toIsoString(returnReq.processedAt) : null,
      createdAt: toIsoString(returnReq.createdAt),
      order: returnReq.Order,
    });
  } catch {
    console.error('[api/returns/[id]] Return details unavailable');
    return NextResponse.json({ error: 'Failed to fetch return request' }, { status: 500 });
  }
}
