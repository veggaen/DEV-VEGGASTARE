/**
 * @fileOverview Seller return request processing API.
 * @stability experimental
 *
 * PATCH /api/returns/[id] — Process a return request (approve/reject/refund)
 *
 * Accessible by the product seller (solo via userId or company employee with CAN_PROCESS_REFUNDS).
 */

import { dbPrisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
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
  refundAmount: z.coerce.number().nonnegative().optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  const sessionUserId = session?.user?.id;
  const sessionUserRole = session?.user?.role;
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  const { action, sellerNote, refundAmount } = parsed.data;

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

    // Authorization: seller must own at least one product in the order
    // Check direct ownership via userId or company membership
    const productOwnerIds = new Set(returnReq.Order.OrderItem.map((oi) => oi.Product.userId));
    const productCompanyIds = returnReq.Order.OrderItem
      .map((oi) => oi.Product.companyId)
      .filter((id: string | null): id is string => id !== null);

    let isAuthorized = productOwnerIds.has(sessionUserId);

    if (!isAuthorized && productCompanyIds.length > 0) {
      // Check if the user is an employee with management rights in any of the product companies
      const employeeRecord = await dbPrisma.employee.findFirst({
        where: {
          userId: sessionUserId,
          companyId: { in: productCompanyIds },
          role: { in: ['OWNER', 'MANAGER'] },
        },
      });
      isAuthorized = !!employeeRecord;
    }

    // Platform admins can also process returns
    if (!isAuthorized && sessionUserRole === 'ADMIN') {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate state transition
    const validTransitions: Record<string, string[]> = {
      PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['REFUNDED', 'CANCELLED'],
    };

    const statusMap: Record<string, string> = {
      APPROVE: 'APPROVED',
      REJECT: 'REJECTED',
      REFUND: 'REFUNDED',
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
      const updatedReturn = await tx.returnRequest.update({
        where: { id },
        data: {
          status: newStatus as 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'CANCELLED' | 'COMPLETED',
          sellerNote: sellerNote?.trim() || returnReq.sellerNote,
          refundAmount: refundAmount ?? returnReq.refundAmount,
          processedBy: sessionUserId,
          processedAt: new Date(),
        },
      });

      // If refunded, update the order's fulfilment status
      if (newStatus === 'REFUNDED') {
        await tx.order.update({
          where: { id: returnReq.orderId },
          data: { fulfilmentStatus: 'RETURNED' },
        });

        // Restore stock for physical products
        for (const item of returnReq.Order.OrderItem) {
          try {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          } catch {
            // Product may have been deleted — non-fatal
          }
        }
      }

      return updatedReturn;
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
    console.error('[api/returns/[id]] Error processing return:', error);
    return NextResponse.json(
      { error: 'Failed to process return request', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
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

    // Authorization: buyer or seller or admin
    const isBuyer = returnReq.userId === sessionUserId;
    const isSeller = returnReq.Order.OrderItem.some((oi) => oi.Product.userId === sessionUserId);
    const isAdmin = sessionUserRole === 'ADMIN';

    if (!isBuyer && !isSeller && !isAdmin) {
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
  } catch (error) {
    console.error('[api/returns/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch return request' }, { status: 500 });
  }
}
