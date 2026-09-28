/** @fileOverview Private seller orders, scoped line items and grouped filter counts. @stability experimental */
import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { resolveVisibleEmail } from '@/lib/email-visibility';
import { isDemoUserId } from '@/lib/demo-policy';
import { SellerOrdersQuery, emptySaleCounts, safeShippingLink } from '@/lib/payments/seller-orders';
import type { Prisma } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to view your sales.' }, { status: 401, headers });
  const viewerId = session.user.id;
  const viewerRole = session.user.role;
  const limitResult = await checkRateLimit(getClientIdentifier(request, viewerId), 'read');
  if (!limitResult.success) return rateLimitedResponse(limitResult);
  const params = new URL(request.url).searchParams;
  const parsed = SellerOrdersQuery.safeParse(Object.fromEntries(params));
  if (!parsed.success || new Set(params.keys()).size !== [...params.keys()].length) {
    return NextResponse.json({ error: 'Invalid order filters.' }, { status: 400, headers });
  }
  const { page, limit, fulfilmentStatus } = parsed.data;
  if (isDemoUserId(viewerId) || session.user.isDemo) return NextResponse.json({
    orders: [], counts: emptySaleCounts(), readOnly: true,
    pagination: { page, limit, total: 0, totalPages: 0 },
  }, { headers });
  try {
    // Preserve existing permission: direct seller or company OWNER. Admin is not an override.
    const companies = await dbPrisma.employee.findMany({ where: { userId: viewerId, role: 'OWNER' }, select: { companyId: true } });
    const product: Prisma.ProductWhereInput = { OR: [
      { userId: viewerId },
      ...(companies.length ? [{ companyId: { not: null, in: companies.map(row => row.companyId) } }] : []),
    ] };
    const item: Prisma.OrderItemWhereInput = { Product: product };
    const scope: Prisma.OrderWhereInput = { OrderItem: { some: item } };
    const [orders, groups] = await Promise.all([
      dbPrisma.order.findMany({
        where: { ...scope, ...(fulfilmentStatus === 'ALL' ? {} : { fulfilmentStatus }) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit,
        select: {
          id: true, createdAt: true, currency: true, status: true, fulfilmentStatus: true,
          shippingName: true, shippingAddress: true, shippingCity: true, shippingPostalCode: true, shippingCountry: true,
          trackingNumber: true, trackingUrl: true, labelUrl: true,
          _count: { select: { OrderItem: true } },
          OrderItem: { where: item, take: 50, orderBy: { id: 'asc' }, select: {
            id: true, productId: true, title: true, quantity: true, priceAtTime: true,
            Product: { select: { productType: true } },
          } },
          User: { select: { id: true, name: true, email: true, emailDisplayMode: true } },
          Payment: { select: { method: true, status: true, receiverAddress: true, senderAddress: true, transactionId: true,
            chainFamily: true, chainId: true, tokenSymbol: true, nativeAmount: true } },
          CheckoutAttempt: { select: { environment: true, state: true } },
        },
      }),
      dbPrisma.order.groupBy({ by: ['fulfilmentStatus'], where: scope, _count: { _all: true } }),
    ]);
    const counts = emptySaleCounts();
    for (const group of groups) { counts[group.fulfilmentStatus] = group._count._all; counts.ALL += group._count._all; }
    const total = counts[fulfilmentStatus];
    return NextResponse.json({ readOnly: false, counts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      orders: orders.map(order => {
        // Do not disclose another seller's whole-order payment/shipment data.
        const sharedOrder = order._count.OrderItem !== order.OrderItem.length;
        const physical = order.OrderItem.some(row => row.Product.productType === 'PHYSICAL');
        const payment = sharedOrder ? null : order.Payment;
        return {
          id: order.id, createdAt: order.createdAt.toISOString(), currency: order.currency,
          status: order.status, fulfilmentStatus: order.fulfilmentStatus, sharedOrder,
          environment: sharedOrder ? null : order.CheckoutAttempt?.environment ?? null,
          sellerTotal: order.OrderItem.reduce((sum, row) => sum + row.quantity * row.priceAtTime, 0),
          itemCount: order.OrderItem.length,
          customer: { name: order.User.name, email: resolveVisibleEmail({ targetUserId: order.User.id, targetEmail: order.User.email,
            targetEmailDisplayMode: order.User.emailDisplayMode, viewerUserId: viewerId, viewerRole }) },
          shipping: physical ? { name: order.shippingName, address: order.shippingAddress, city: order.shippingCity,
            postalCode: order.shippingPostalCode, country: order.shippingCountry } : null,
          tracking: physical && !sharedOrder ? { number: order.trackingNumber, url: safeShippingLink(order.trackingUrl), labelUrl: safeShippingLink(order.labelUrl) } : null,
          items: order.OrderItem.map(row => ({ id: row.id, productId: row.productId, title: row.title, quantity: row.quantity,
            priceAtTime: row.priceAtTime, productType: row.Product.productType })),
          payment: payment ? { method: payment.method, status: payment.status, environment: order.CheckoutAttempt?.environment ?? null,
            state: order.CheckoutAttempt?.state ?? null, receiver: payment.receiverAddress, sender: payment.senderAddress,
            reference: payment.transactionId, chainFamily: payment.chainFamily, chainId: payment.chainId,
            tokenSymbol: payment.tokenSymbol, nativeAmount: payment.nativeAmount } : null,
        };
      }),
    }, { headers });
  } catch {
    console.error('[seller/orders] Sales list unavailable');
    return NextResponse.json({ error: 'Your sales could not be loaded. Please try again.' }, { status: 503, headers });
  }
}
