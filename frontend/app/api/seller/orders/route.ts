/**
 * @fileOverview Solo seller orders API — shows orders containing products owned by the seller.
 * @stability experimental
 *
 * GET /api/seller/orders
 * Returns orders that contain items from products the current user owns
 * (either via userId or via a company they own). This bridges the solo-seller gap
 * where sellers without a company dashboard can still see their incoming orders.
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

const QuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  fulfilmentStatus: z.enum(['ALL', 'UNFULFILLED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED']).default('ALL'),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting
  const identifier = getClientIdentifier(request, session.user.id);
  const rateLimitResult = await checkRateLimit(identifier, 'read');
  if (!rateLimitResult.success) {
    return rateLimitedResponse(rateLimitResult);
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const queryParsed = QuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!queryParsed.success) {
    return NextResponse.json(
      { error: 'Invalid query params', ...(isDev ? { issues: queryParsed.error.issues } : {}) },
      { status: 400 },
    );
  }

  const { page, limit, fulfilmentStatus } = queryParsed.data;

  try {
    // Find all products owned by this user (directly or via their companies)
    const userCompanies = await dbPrisma.employee.findMany({
      where: { userId: session.user.id, role: 'OWNER' },
      select: { companyId: true },
    });
    const companyIds = userCompanies.map((c: { companyId: string }) => c.companyId);

    // Products where userId matches OR companyId is one the user owns
    const productFilter = {
      OR: [
        { userId: session.user.id },
        ...(companyIds.length > 0 ? [{ companyId: { in: companyIds } }] : []),
      ],
    };

    const sellerProductIds = await dbPrisma.product.findMany({
      where: productFilter,
      select: { id: true },
    });
    const productIdSet = sellerProductIds.map(p => p.id);

    if (productIdSet.length === 0) {
      return NextResponse.json({
        orders: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    // Find orders containing items from seller's products
    const orderItemFilter: Record<string, unknown> = {
      some: { productId: { in: productIdSet } },
    };
    const fulfilmentFilter = fulfilmentStatus !== 'ALL'
      ? { fulfilmentStatus }
      : {};

    const [orders, total] = await Promise.all([
      dbPrisma.order.findMany({
        where: {
          OrderItem: orderItemFilter,
          ...fulfilmentFilter,
        },
        include: {
          OrderItem: {
            where: { productId: { in: productIdSet } },
            include: {
              Product: {
                select: { id: true, title: true, image: true, productType: true, companyId: true },
              },
            },
          },
          Payment: { select: { method: true, status: true } },
          User: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbPrisma.order.count({
        where: {
          OrderItem: orderItemFilter,
          ...fulfilmentFilter,
        },
      }),
    ]);

    const dto = orders.map(o => ({
      id: o.id,
      createdAt: toIsoString(o.createdAt),
      totalAmount: o.totalAmount,
      status: o.status,
      fulfilmentStatus: o.fulfilmentStatus,
      shippedAt: o.shippedAt ? toIsoString(o.shippedAt) : null,
      deliveredAt: o.deliveredAt ? toIsoString(o.deliveredAt) : null,
      trackingNumber: o.trackingNumber ?? null,
      trackingUrl: o.trackingUrl ?? null,
      labelUrl: o.labelUrl ?? null,
      shippingServiceName: o.shippingServiceName ?? null,
      estimatedDelivery: o.estimatedDelivery ? toIsoString(o.estimatedDelivery) : null,
      shipping: {
        name: o.shippingName,
        address: o.shippingAddress,
        city: o.shippingCity,
        postalCode: o.shippingPostalCode,
        country: o.shippingCountry,
        phone: o.shippingPhone,
        email: o.shippingEmail,
        method: o.shippingMethod,
        cost: o.shippingCost,
      },
      customer: {
        id: o.User.id,
        name: o.User.name,
        email: o.User.email,
      },
      items: o.OrderItem.map(oi => ({
        id: oi.id,
        quantity: oi.quantity,
        priceAtTime: oi.priceAtTime,
        title: oi.title,
        product: oi.Product,
      })),
      payment: o.Payment ? { method: o.Payment.method, status: o.Payment.status } : null,
    }));

    return NextResponse.json({
      orders: dto,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[api/seller/orders] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch seller orders', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
      { status: 500 },
    );
  }
}
