/**
 * @fileOverview  Shared logic for completing a fiat (non-crypto) order after payment capture.
 * @stability     stable
 *
 * Called from:
 * - POST /api/payments/paypal/capture  (PayPal return URL)
 * - POST /api/payments/webhook/[provider]  (webhook fallback)
 *
 * Handles:
 * - Updating order & payment status → COMPLETED
 * - hasWeb2Payment flag + verification tier   
 * - Download token generation
 * - Auto-fulfil digital-only orders
 * - Order confirmation email
 * - Seller & warehouse notifications
 * - Repo access grants
 * - In-app notification
 */

import { dbPrisma } from '@/lib/db';
import { sendOrderConfirmationEmail, sendSellerOrderNotification, sendWarehouseOrderNotification } from '@/lib/mail';
import { generateDownloadTokensForOrder } from '@/lib/download-tokens';
import { recalculateVerificationTier } from '@/lib/verification-recalc';
import { grantRepoAccessForOrder } from '@/lib/github-repo-access';

export interface CompleteFiatOrderResult {
  success: boolean;
  orderId: string;
  alreadyCompleted?: boolean;
  error?: string;
}

/**
 * Transition a PENDING fiat order to COMPLETED and run all post-payment side effects.
 * Idempotent — returns early if order is already COMPLETED.
 */
export async function completeFiatOrder(
  orderId: string,
  opts: {
    paymentTransactionId?: string;
    source: string; // e.g. 'paypal-capture', 'webhook-paypal'
  }
): Promise<CompleteFiatOrderResult> {
  // 1. Fetch order + payment
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

  // Idempotent — don't re-complete
  if (order.status === 'COMPLETED') {
    return { success: true, orderId, alreadyCompleted: true };
  }

  // 2. Update order + payment status
  await dbPrisma.$transaction([
    dbPrisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        transactionId: opts.paymentTransactionId ?? order.transactionId,
      },
    }),
    ...(order.Payment
      ? [
          dbPrisma.payment.update({
            where: { orderId },
            data: {
              status: 'COMPLETED',
              transactionId: opts.paymentTransactionId ?? order.Payment.transactionId,
            },
          }),
        ]
      : []),
  ]);

  console.log(`[completeFiatOrder] Order ${orderId} completed via ${opts.source}`);

  // 3. Set hasWeb2Payment flag + recalculate tier
  try {
    await dbPrisma.user.update({
      where: { id: order.userId },
      data: { hasWeb2Payment: true },
    });
    await recalculateVerificationTier(order.userId, { hasWeb2Payment: true });
  } catch (err) {
    console.error('[completeFiatOrder] Failed to set hasWeb2Payment:', err);
  }

  // 4. Generate download tokens for digital products
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
      console.error('[completeFiatOrder] Download token generation failed:', err);
    }
  }

  // 5. Auto-fulfil digital-only orders
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
      console.error('[completeFiatOrder] Auto-fulfil failed:', err);
    }
  }

  // 6. Send confirmation email (non-blocking)
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
      });
    } catch (err) {
      console.error('[completeFiatOrder] Confirmation email failed:', err);
    }
  }

  // 7. Seller & warehouse notifications (fire-and-forget)
  notifySellersInBackground(order).catch((err) =>
    console.error('[completeFiatOrder] Seller notification error:', err)
  );

  // 8. Grant repo access
  try {
    await grantRepoAccessForOrder(order.id, opts.source);
  } catch (err) {
    console.error('[completeFiatOrder] Repo access grant failed:', err);
  }

  // 9. In-app notification
  try {
    await dbPrisma.notification.create({
      data: {
        userId: order.userId,
        type: 'SYSTEM',
        title: 'Payment confirmed — order complete',
        message: `Your order #${order.id.slice(0, 8)} has been paid and confirmed.`,
        preview: `Order #${order.id.slice(0, 8)} • ${items.length} item(s) • ${order.totalAmount}`,
        metadata: { orderId: order.id, orderStatus: 'COMPLETED', source: opts.source },
      },
    });
  } catch (err) {
    console.error('[completeFiatOrder] Notification creation failed:', err);
  }

  return { success: true, orderId };
}

/* ────────────────────────────────────────────────────────────── */

async function notifySellersInBackground(
  order: {
    id: string;
    totalAmount: unknown;
    shippingName: string | null;
    shippingAddress: string | null;
    shippingCity: string | null;
    shippingPostalCode: string | null;
    shippingCountry: string | null;
    shippingPhone: string | null;
    shippingMethod: string | null;
    OrderItem: { productId: string; quantity: number; title: string }[];
  },
) {
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
            where: { role: 'OWNER' },
            select: { User: { select: { email: true } } },
          },
          WarehouseLocation: {
            where: { isActive: true },
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  // Group items by seller
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
    let sellerEmail: string | null = null;

    if (product.Company?.Employee?.[0]?.User?.email) {
      sellerEmail = product.Company.Employee[0].User.email;
    } else if (product.User?.email) {
      sellerEmail = product.User.email;
    }

    if (sellerEmail) {
      const existing = sellerMap.get(sellerEmail);
      if (existing) {
        existing.items.push({ ...item, priceAtTime: 0 });
        if (!isDigital) existing.isDigital = false;
      } else {
        sellerMap.set(sellerEmail, {
          email: sellerEmail,
          items: [{ ...item, priceAtTime: 0 }],
          isDigital,
        });
      }
    }

    // Warehouse notification for physical/hybrid
    if (product.productType !== 'DIGITAL' && product.Company?.WarehouseLocation?.length) {
      const employeeEmails = product.Company.Employee
        ?.map((e: { User: { email: string | null } }) => e.User?.email)
        .filter(Boolean) as string[];

      for (const warehouse of product.Company.WarehouseLocation) {
        if (employeeEmails.length > 0) {
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
            console.error(`[completeFiatOrder] Warehouse email failed:`, whErr);
          }
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
      console.error(`[completeFiatOrder] Seller email failed:`, err);
    }
  }
}
