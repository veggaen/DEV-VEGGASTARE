/**
 * @fileOverview PATCH /api/orders/[id]/shipping — Update shipping & tracking
 *   info on an order. Called after Bring booking to persist tracking number,
 *   consignment ID, and estimated delivery.
 * @stability maturing
 */
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

const UpdateShippingSchema = z.object({
  trackingNumber: z.string().trim().max(100).optional().nullable(),
  trackingUrl: z.string().url().max(500).optional().nullable(),
  bringConsignmentId: z.string().trim().max(100).optional().nullable(),
  estimatedDelivery: z.string().max(50).optional().nullable(),
  shippingServiceName: z.string().trim().max(200).optional().nullable(),
  shippingMethod: z.string().trim().max(100).optional().nullable(),
  shippingCost: z.coerce.number().nonnegative().optional().nullable(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
  }

  const bodyResult = await parseJsonOrError(request, UpdateShippingSchema);
  if (!bodyResult.ok) return bodyResult.response;

  // Verify order belongs to user (or user is admin)
  const order = await dbPrisma.order.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const isOwner = order.userId === session.id;
  const isAdmin = session.role === 'ADMIN';
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = bodyResult.data;

  const updated = await dbPrisma.order.update({
    where: { id },
    data: {
      ...(data.trackingNumber !== undefined && { trackingNumber: data.trackingNumber }),
      ...(data.trackingUrl !== undefined && { trackingUrl: data.trackingUrl }),
      ...(data.bringConsignmentId !== undefined && { bringConsignmentId: data.bringConsignmentId }),
      ...(data.estimatedDelivery !== undefined && {
        estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
      }),
      ...(data.shippingServiceName !== undefined && { shippingServiceName: data.shippingServiceName }),
      ...(data.shippingMethod !== undefined && { shippingMethod: data.shippingMethod }),
      ...(data.shippingCost !== undefined && { shippingCost: data.shippingCost }),
    },
    select: {
      id: true,
      trackingNumber: true,
      trackingUrl: true,
      bringConsignmentId: true,
      estimatedDelivery: true,
      shippingServiceName: true,
      shippingMethod: true,
      shippingCost: true,
    },
  });

  return NextResponse.json(updated);
}
