/**
 * @fileOverview Book Bring shipment for a paid order using stored order data.
 * @stability maturing
 */

import { dbPrisma } from '@/lib/db';

export type PaidOrderShipmentResult = {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  estimatedDelivery?: string | null;
};

function resolveOrigin(origin?: string) {
  return (
    origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export async function bookPaidOrderShipment(
  orderId: string,
  opts: {
    origin?: string;
    source: string;
  }
): Promise<PaidOrderShipmentResult> {
  const order = await dbPrisma.order.findUnique({
    where: { id: orderId },
    include: {
      OrderItem: {
        include: {
          Product: {
            select: {
              id: true,
              title: true,
              productType: true,
              companyId: true,
            },
          },
        },
      },
    },
  });

  if (!order) return { success: false, reason: 'Order not found' };
  if (order.status !== 'COMPLETED') {
    return { success: false, skipped: true, reason: `Order is ${order.status}` };
  }
  if (order.trackingNumber || order.bringConsignmentId) {
    return {
      success: true,
      skipped: true,
      reason: 'Shipment already booked',
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      estimatedDelivery: order.estimatedDelivery?.toISOString() ?? null,
    };
  }

  const physicalItems = order.OrderItem.filter((item) => item.Product.productType !== 'DIGITAL');
  if (physicalItems.length === 0) {
    return { success: true, skipped: true, reason: 'Digital-only order' };
  }

  if (!order.shippingName || !order.shippingAddress || !order.shippingPostalCode || !order.shippingCity) {
    return { success: false, skipped: true, reason: 'Missing shipping address' };
  }

  const physicalProductIds = physicalItems.map((item) => item.productId);
  const companyIds = physicalItems
    .map((item) => item.Product.companyId)
    .filter(Boolean) as string[];

  const warehouse =
    (await dbPrisma.warehouseLocation.findFirst({
      where: {
        isActive: true,
        Inventory: { some: { productId: { in: physicalProductIds } } },
      },
      orderBy: { updatedAt: 'desc' },
    })) ??
    (companyIds.length > 0
      ? await dbPrisma.warehouseLocation.findFirst({
          where: {
            isActive: true,
            companyId: { in: companyIds },
          },
          orderBy: { updatedAt: 'desc' },
        })
      : null);

  if (!warehouse) {
    return { success: false, skipped: true, reason: 'No active warehouse sender address' };
  }

  const description = physicalItems
    .map((item) => `${item.quantity}x ${item.title}`)
    .join(', ')
    .slice(0, 200);

  const bookingResponse = await fetch(`${resolveOrigin(opts.origin)}/api/bring-booking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: {
        name: warehouse.name || `Warehouse ${warehouse.city}`,
        address: warehouse.address,
        postalCode: warehouse.postalCode,
        city: warehouse.city,
        countryCode: warehouse.country || 'NO',
      },
      recipient: {
        name: order.shippingName,
        address: order.shippingAddress,
        postalCode: order.shippingPostalCode,
        city: order.shippingCity,
        countryCode: order.shippingCountry || 'NO',
        email: order.shippingEmail || undefined,
        phone: order.shippingPhone || undefined,
      },
      packages: [
        {
          weight: physicalItems.reduce((sum, item) => sum + item.quantity * 1000, 0),
          description,
        },
      ],
      serviceCode: order.shippingMethod || '5800',
      orderId,
    }),
  });

  const bookingResult = await bookingResponse.json().catch(() => ({}));
  if (!bookingResponse.ok || !bookingResult.success) {
    return {
      success: false,
      skipped: true,
      reason: bookingResult.error || 'Bring booking failed',
    };
  }

  const updated = await dbPrisma.order.update({
    where: { id: orderId },
    data: {
      trackingNumber: bookingResult.booking?.consignmentNumber ?? null,
      trackingUrl: bookingResult.booking?.trackingUrl ?? null,
      bringConsignmentId: bookingResult.booking?.consignmentNumber ?? null,
      labelUrl: bookingResult.booking?.labelUrl ?? null,
      shippingServiceName: order.shippingMethod,
    },
    select: {
      trackingNumber: true,
      trackingUrl: true,
      estimatedDelivery: true,
    },
  });

  console.log(`[bookPaidOrderShipment] Shipment booked for ${orderId} via ${opts.source}`);

  return {
    success: true,
    trackingNumber: updated.trackingNumber,
    trackingUrl: updated.trackingUrl,
    estimatedDelivery: updated.estimatedDelivery?.toISOString() ?? null,
  };
}
