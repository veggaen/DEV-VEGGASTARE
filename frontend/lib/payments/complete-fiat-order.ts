/**
 * @fileOverview Shared logic for completing a paid order after payment confirmation.
 * @stability stable
 *
 * Called from:
 * - GET /api/payments/paypal/capture
 * - POST /api/payments/webhook/[provider]
 * - POST /api/orders/confirm
 *
 * Handles:
 * - Updating order/payment status to COMPLETED
 * - Web2/Web3 payment verification flags
 * - Warehouse inventory decrement for paid physical/hybrid orders
 * - Download token generation
 * - Digital-only auto-fulfilment
 * - Buyer confirmation email
 * - Seller and warehouse notification emails
 * - Repo access grants
 * - In-app notification
 */

import { dbPrisma } from '@/lib/db';
import { sendOrderConfirmationEmail, sendSellerOrderNotification, sendWarehouseOrderNotification } from '@/lib/mail';
import { generateDownloadTokensForOrder } from '@/lib/download-tokens';
import { recalculateVerificationTier } from '@/lib/verification-recalc';
import { grantRepoAccessForOrder } from '@/lib/github-repo-access';
import { pusherServer } from '@/lib/pusher';
import { bookPaidOrderShipment } from '@/lib/shipping/book-paid-order-shipment';

export interface CompletePaidOrderResult {
  success: boolean;
  orderId: string;
  alreadyCompleted?: boolean;
  error?: string;
}

export type CompleteFiatOrderResult = CompletePaidOrderResult;

type CompletePaidOrderKind = 'web2' | 'web3';

type InventoryUpdateEvent = {
  warehouseId: string;
  inventoryId: string;
  stock: number;
  version: number;
  product: {
    id: string;
    title: string;
  };
};

type OrderForNotifications = {
  id: string;
  totalAmount: unknown;
  shippingName: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  shippingPhone: string | null;
  shippingMethod: string | null;
  OrderItem: { productId: string; quantity: number; priceAtTime: number; title: string }[];
};

export async function completePaidOrder(
  orderId: string,
  opts: {
    paymentTransactionId?: string;
    blockNumber?: number | null;
    origin?: string;
    paymentKind: CompletePaidOrderKind;
    source: string;
  }
): Promise<CompletePaidOrderResult> {
  const order = await dbPrisma.order.findUnique({
    where: { id: orderId },
    include: {
      Payment: true,
      OrderItem: true,
      User: { select: { id: true, email: true, name: true } },
    },
  });

  if (!order) {
    return { success: false, orderId, error: 'Order not found' };
  }

  if (order.status === 'COMPLETED') {
    return { success: true, orderId, alreadyCompleted: true };
  }

  if (order.status === 'FAILED' || order.status === 'CANCELLED') {
    return { success: false, orderId, error: `Order is ${order.status}` };
  }

  let inventoryUpdates: InventoryUpdateEvent[] = [];
  try {
    inventoryUpdates = await dbPrisma.$transaction(async (tx) => {
      const freshOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          Payment: true,
          OrderItem: {
            include: {
              Product: {
                select: {
                  id: true,
                  title: true,
                  productType: true,
                },
              },
            },
          },
        },
      });

      if (!freshOrder) throw new Error('Order not found');
      if (freshOrder.status === 'COMPLETED') return [];
      if (freshOrder.status === 'FAILED' || freshOrder.status === 'CANCELLED') {
        throw new Error(`Order is ${freshOrder.status}`);
      }

      const updates: InventoryUpdateEvent[] = [];

      for (const item of freshOrder.OrderItem) {
        if (item.Product.productType === 'DIGITAL') continue;

        const preferredInventory = await tx.inventory.findFirst({
          where: {
            productId: item.productId,
            stock: { gte: item.quantity },
            WarehouseLocation: { isActive: true },
          },
          orderBy: { stock: 'desc' },
          select: {
            id: true,
            stock: true,
            version: true,
            warehouseId: true,
            Product: { select: { id: true, title: true } },
          },
        });

        const inventory =
          preferredInventory ??
          (await tx.inventory.findFirst({
            where: {
              productId: item.productId,
              WarehouseLocation: { isActive: true },
            },
            orderBy: { stock: 'desc' },
            select: {
              id: true,
              stock: true,
              version: true,
              warehouseId: true,
              Product: { select: { id: true, title: true } },
            },
          }));

        if (!inventory) {
          console.warn(`[completePaidOrder] No warehouse inventory row found for product ${item.productId}`);
          continue;
        }

        const updatedInventory = await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            stock: { decrement: item.quantity },
            version: { increment: 1 },
          },
          select: {
            id: true,
            stock: true,
            version: true,
            warehouseId: true,
            Product: { select: { id: true, title: true } },
          },
        });

        updates.push({
          warehouseId: updatedInventory.warehouseId,
          inventoryId: updatedInventory.id,
          stock: updatedInventory.stock,
          version: updatedInventory.version,
          product: {
            id: updatedInventory.Product.id,
            title: updatedInventory.Product.title,
          },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          transactionId: opts.paymentTransactionId ?? freshOrder.transactionId,
        },
      });

      if (freshOrder.Payment) {
        await tx.payment.update({
          where: { orderId },
          data: {
            status: 'COMPLETED',
            transactionId: opts.paymentTransactionId ?? freshOrder.Payment.transactionId,
            ...(opts.blockNumber != null ? { blockNumber: opts.blockNumber } : {}),
          },
        });
      }

      return updates;
    }, {
      timeout: 15000,
      isolationLevel: 'Serializable',
    });
  } catch (err) {
    console.error('[completePaidOrder] Completion transaction failed:', err);
    return {
      success: false,
      orderId,
      error: err instanceof Error ? err.message : 'Completion failed',
    };
  }

  console.log(`[completePaidOrder] Order ${orderId} completed via ${opts.source}`);
  await publishWarehouseInventoryUpdates(inventoryUpdates, opts.source);

  try {
    if (opts.paymentKind === 'web3') {
      await dbPrisma.user.update({
        where: { id: order.userId },
        data: { hasWeb3Payment: true },
      });
      await recalculateVerificationTier(order.userId, { hasWeb3Payment: true });
    } else {
      await dbPrisma.user.update({
        where: { id: order.userId },
        data: { hasWeb2Payment: true },
      });
      await recalculateVerificationTier(order.userId, { hasWeb2Payment: true });
    }
  } catch (err) {
    console.error('[completePaidOrder] Failed to set payment verification flag:', err);
  }

  const items = order.OrderItem ?? [];
  let downloadTokens: Awaited<ReturnType<typeof generateDownloadTokensForOrder>> = [];

  if (items.length > 0) {
    try {
      downloadTokens = await generateDownloadTokensForOrder({
        orderId: order.id,
        userId: order.userId,
        orderItems: items.map((oi) => ({ id: oi.id, productId: oi.productId })),
      });
    } catch (err) {
      console.error('[completePaidOrder] Download token generation failed:', err);
    }
  }

  if (items.length > 0) {
    try {
      const productIds = items.map((i) => i.productId);
      const productTypes = await dbPrisma.product.findMany({
        where: { id: { in: productIds } },
        select: { productType: true },
      });
      const allDigital =
        productTypes.length > 0 && productTypes.every((p) => p.productType === 'DIGITAL');

      if (allDigital) {
        await dbPrisma.order.update({
          where: { id: order.id },
          data: { fulfilmentStatus: 'DELIVERED', deliveredAt: new Date() },
        });
      }
    } catch (err) {
      console.error('[completePaidOrder] Auto-fulfil failed:', err);
    }
  }

  let shipment: Awaited<ReturnType<typeof bookPaidOrderShipment>> | null = null;
  try {
    shipment = await bookPaidOrderShipment(order.id, {
      origin: opts.origin,
      source: opts.source,
    });
    if (!shipment.success && !shipment.skipped) {
      console.warn('[completePaidOrder] Shipment booking failed:', shipment.reason);
    }
  } catch (err) {
    console.error('[completePaidOrder] Shipment booking failed:', err);
  }

  const emailTo = order.shippingEmail || order.User?.email;
  if (emailTo) {
    try {
      await sendOrderConfirmationEmail(emailTo, {
        orderId: order.id,
        name: order.shippingName || order.User?.name || 'Customer',
        items: items.map((oi) => ({
          productId: oi.productId,
          quantity: oi.quantity,
          priceAtTime: Number(oi.priceAtTime),
          title: oi.title,
        })),
        totalAmount: Number(order.totalAmount),
        shippingAddress: order.shippingAddress ?? '',
        shippingCity: order.shippingCity ?? '',
        shippingPostalCode: order.shippingPostalCode ?? '',
        shippingCountry: order.shippingCountry ?? 'NO',
        transactionId: opts.paymentTransactionId ?? order.transactionId ?? undefined,
        downloadLinks: downloadTokens.length > 0 ? downloadTokens : undefined,
        shippingMethodName: order.shippingMethod ?? undefined,
        shippingCost: order.shippingCost ? Number(order.shippingCost) : undefined,
        trackingNumber: shipment?.trackingNumber ?? undefined,
        trackingUrl: shipment?.trackingUrl ?? undefined,
        estimatedDelivery: shipment?.estimatedDelivery ?? undefined,
      });
    } catch (err) {
      console.error('[completePaidOrder] Confirmation email failed:', err);
    }
  }

  notifySellersInBackground(order).catch((err) =>
    console.error('[completePaidOrder] Seller notification error:', err)
  );

  try {
    await grantRepoAccessForOrder(order.id, opts.source);
  } catch (err) {
    console.error('[completePaidOrder] Repo access grant failed:', err);
  }

  try {
    await dbPrisma.notification.create({
      data: {
        userId: order.userId,
        type: 'SYSTEM',
        title: 'Payment confirmed - order complete',
        message: `Your order #${order.id.slice(0, 8)} has been paid and confirmed.`,
        preview: `Order #${order.id.slice(0, 8)} - ${items.length} item(s) - ${order.totalAmount}`,
        metadata: { orderId: order.id, orderStatus: 'COMPLETED', source: opts.source },
      },
    });
  } catch (err) {
    console.error('[completePaidOrder] Notification creation failed:', err);
  }

  return { success: true, orderId };
}

export async function completeFiatOrder(
  orderId: string,
  opts: {
    paymentTransactionId?: string;
    origin?: string;
    source: string;
  }
): Promise<CompleteFiatOrderResult> {
  return completePaidOrder(orderId, {
    ...opts,
    paymentKind: 'web2',
  });
}

export async function releaseReservedOrderStock(
  orderId: string,
  opts: {
    source: string;
    status?: 'FAILED' | 'CANCELLED';
    paymentTransactionId?: string;
  }
): Promise<CompletePaidOrderResult> {
  try {
    const release = await dbPrisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          Payment: true,
          OrderItem: true,
        },
      });

      if (!order) throw new Error('Order not found');
      if (order.status === 'COMPLETED') {
        return { alreadyCompleted: true, released: false };
      }
      if (order.status === 'FAILED' || order.status === 'CANCELLED') {
        return { alreadyCompleted: false, released: false };
      }

      for (const item of order.OrderItem) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: opts.status ?? 'CANCELLED',
          transactionId: opts.paymentTransactionId ?? order.transactionId,
        },
      });

      if (order.Payment) {
        await tx.payment.update({
          where: { orderId },
          data: {
            status: 'FAILED',
            transactionId: opts.paymentTransactionId ?? order.Payment.transactionId,
          },
        });
      }

      return { alreadyCompleted: false, released: true };
    }, {
      timeout: 15000,
      isolationLevel: 'Serializable',
    });

    if (release.alreadyCompleted) {
      return { success: true, orderId, alreadyCompleted: true };
    }

    console.log(`[releaseReservedOrderStock] Order ${orderId} ${release.released ? 'released' : 'already released'} via ${opts.source}`);
    return { success: true, orderId };
  } catch (err) {
    console.error('[releaseReservedOrderStock] Failed:', err);
    return {
      success: false,
      orderId,
      error: err instanceof Error ? err.message : 'Release failed',
    };
  }
}

async function publishWarehouseInventoryUpdates(updates: InventoryUpdateEvent[], source: string) {
  for (const update of updates) {
    try {
      await pusherServer.trigger(`WarehouseChannel_${update.warehouseId}`, 'my-event-warehouse', {
        type: 'INVENTORY_UPDATE',
        source,
        payload: update,
      });
    } catch (err) {
      console.error('[completePaidOrder] Warehouse pusher update failed:', err);
    }
  }
}

async function notifySellersInBackground(order: OrderForNotifications) {
  const items = order.OrderItem;
  if (items.length === 0) return;

  const productIds = items.map((i) => i.productId);
  const productsWithOwners = await dbPrisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      productType: true,
      userId: true,
      companyId: true,
      User: { select: { email: true, name: true } },
      Company: {
        select: {
          id: true,
          name: true,
          Employee: {
            where: { role: { in: ['OWNER', 'MANAGER', 'WAREHOUSE_MANAGER', 'WAREHOUSE_WORKER'] } },
            select: { role: true, User: { select: { email: true } } },
          },
          WarehouseLocation: {
            where: { isActive: true },
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  type SellerEntry = {
    email: string;
    items: { productId: string; quantity: number; priceAtTime: number; title: string }[];
    isDigital: boolean;
  };

  const sellerMap = new Map<string, SellerEntry>();

  for (const product of productsWithOwners) {
    const item = items.find((i) => i.productId === product.id);
    if (!item) continue;

    const isDigital = product.productType === 'DIGITAL';
    const ownerEmail =
      product.Company?.Employee?.find((e) => e.role === 'OWNER')?.User?.email ??
      product.User?.email ??
      null;

    if (ownerEmail) {
      const existing = sellerMap.get(ownerEmail);
      if (existing) {
        existing.items.push(item);
        if (!isDigital) existing.isDigital = false;
      } else {
        sellerMap.set(ownerEmail, {
          email: ownerEmail,
          items: [item],
          isDigital,
        });
      }
    }

    if (product.productType !== 'DIGITAL' && product.Company?.WarehouseLocation?.length) {
      const employeeEmails = product.Company.Employee
        ?.map((e) => e.User?.email)
        .filter(Boolean) as string[];

      for (const warehouse of product.Company.WarehouseLocation) {
        if (employeeEmails.length === 0) continue;

        try {
          await sendWarehouseOrderNotification(employeeEmails, {
            orderId: order.id,
            items: [{ title: item.title, quantity: item.quantity }],
            buyerName: order.shippingName || 'Customer',
            shippingAddress: order.shippingAddress || '',
            shippingCity: order.shippingCity || '',
            shippingPostalCode: order.shippingPostalCode || '',
            shippingCountry: order.shippingCountry || 'NO',
            shippingPhone: order.shippingPhone ?? undefined,
            shippingMethodName: order.shippingMethod ?? undefined,
            warehouseName: warehouse.name || product.Company!.name,
          });
        } catch (whErr) {
          console.error('[completePaidOrder] Warehouse email failed:', whErr);
        }
      }
    }
  }

  for (const [, seller] of sellerMap) {
    try {
      await sendSellerOrderNotification(seller.email, {
        orderId: order.id,
        items: seller.items,
        totalAmount: Number(order.totalAmount),
        buyerName: order.shippingName || 'Customer',
        shippingAddress: order.shippingAddress ?? undefined,
        shippingCity: order.shippingCity ?? undefined,
        shippingPostalCode: order.shippingPostalCode ?? undefined,
        shippingCountry: order.shippingCountry ?? undefined,
        shippingPhone: order.shippingPhone ?? undefined,
        shippingMethodName: order.shippingMethod ?? undefined,
        isDigital: seller.isDigital,
      });
    } catch (err) {
      console.error('[completePaidOrder] Seller email failed:', err);
    }
  }
}
