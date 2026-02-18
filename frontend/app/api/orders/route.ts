import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { PaymentMethod, ChainFamily } from '@/generated/prisma/browser';
import type { Prisma } from '@/generated/prisma/client';
import { z } from 'zod';
import { OrderDtoSchema } from '@/lib/types/orders';
import { sendOrderConfirmationEmail } from '@/lib/mail';
import { generateDownloadTokensForOrder } from '@/lib/download-tokens';
import { recalculateVerificationTier } from '@/lib/verification-recalc';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

// Schema for order items from checkout
const OrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  priceAtTime: z.coerce.number().nonnegative(),
  title: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.id;

  const bodyResult = await parseJsonOrError(
    req,
    z.object({
      // NOTE: never trust client-supplied userId; always use session user
      totalAmount: z.coerce.number().finite().positive(),
      transactionId: z.string().trim().min(1).max(200).optional().nullable(),
      commentOrder: z.string().trim().max(2000).optional().nullable(),
      commentPay: z.string().trim().max(2000).optional().nullable(),
      method: z.nativeEnum(PaymentMethod).optional().nullable(),
      // Crypto on-chain data
      chainFamily: z.nativeEnum(ChainFamily).optional().nullable(),
      chainId: z.coerce.number().int().optional().nullable(),
      tokenSymbol: z.string().trim().max(20).optional().nullable(),
      nativeAmount: z.string().trim().max(100).optional().nullable(),
      senderAddress: z.string().trim().max(200).optional().nullable(),
      receiverAddress: z.string().trim().max(200).optional().nullable(),
      blockNumber: z.coerce.number().int().optional().nullable(),
      nokRateAtTime: z.coerce.number().optional().nullable(),
      usdRateAtTime: z.coerce.number().optional().nullable(),
      // Shipping fields
      shippingName: z.string().trim().min(2).max(200).optional().nullable(),
      shippingAddress: z.string().trim().min(3).max(500).optional().nullable(),
      shippingCity: z.string().trim().min(2).max(100).optional().nullable(),
      shippingPostalCode: z.string().trim().min(4).max(10).optional().nullable(),
      shippingCountry: z.string().trim().length(2).default('NO'),
      shippingPhone: z.string().trim().max(20).optional().nullable(),
      shippingEmail: z.string().email().optional().nullable(),
      shippingMethod: z.string().trim().max(100).optional().nullable(),
      shippingCost: z.coerce.number().nonnegative().optional().nullable(),
      // Order items
      items: z.array(OrderItemSchema).optional(),
    })
  );
  if (!bodyResult.ok) return bodyResult.response;

  const { 
    totalAmount, transactionId, commentOrder, commentPay, method,
    chainFamily, chainId, tokenSymbol, nativeAmount, senderAddress, receiverAddress, blockNumber,
    nokRateAtTime, usdRateAtTime,
    shippingName, shippingAddress, shippingCity, shippingPostalCode, 
    shippingCountry, shippingPhone, shippingEmail, shippingMethod, shippingCost,
    items 
  } = bodyResult.data;

  // --- SERVER-SIDE PRICE VERIFICATION & STOCK CHECK ---
  // Stock validation + reservation is handled atomically inside the transaction below.
  // Pre-validate product existence and prices first (read-only, no lock needed).
  let serverTotal = 0;
  const productMap = new Map<string, { id: string; price: number; stock: number | null; title: string }>();

  if (items && items.length > 0) {
    const productIds = items.map(i => i.productId);
    const products = await dbPrisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true, stock: true, title: true },
    });
    for (const p of products) productMap.set(p.id, p);

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 }
        );
      }
      // Verify price — allow small rounding diff (≤0.02) but reject manipulated prices
      if (Math.abs(Number(product.price) - item.priceAtTime) > 0.02) {
        return NextResponse.json(
          { error: `Price mismatch for "${product.title}": expected ${product.price}, got ${item.priceAtTime}` },
          { status: 400 }
        );
      }
      serverTotal += Number(product.price) * item.quantity;
    }

    // Verify total (allow up to 1.00 tolerance for shipping/rounding)
    const shippingAddon = shippingCost ?? 0;
    if (Math.abs(serverTotal + shippingAddon - totalAmount) > 1.0) {
      console.warn(`[api/orders] Total mismatch: server=${serverTotal} + shipping=${shippingAddon}, client=${totalAmount}`);
    }
  }

  // Determine initial status: crypto payments start as CONFIRMING, fiat as COMPLETED
  const isCryptoPayment = !!chainFamily || method === PaymentMethod.CRYPTO_NATIVE;
  const initialOrderStatus = isCryptoPayment ? 'CONFIRMING' : 'COMPLETED';
  const initialPaymentStatus = isCryptoPayment ? 'CONFIRMING' : 'COMPLETED';

  try {
    // ── Atomic order creation + stock reservation ──
    // Uses an interactive transaction so stock check + decrement + order insert
    // happen under the same serializable snapshot, preventing overselling.
    const order = await dbPrisma.$transaction(async (tx) => {
      // 1. Lock and verify stock for each item (SELECT ... FOR UPDATE equivalent)
      if (items && items.length > 0) {
        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true, stock: true, title: true },
          });
          if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
          }
          if (product.stock !== null && product.stock < item.quantity) {
            throw new Error(`Insufficient stock for "${product.title}": only ${product.stock} available`);
          }
          // 2. Decrement stock atomically within the transaction
          if (product.stock !== null) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
            });
          }
        }
      }

      // 3. Create order + payment + items in the same transaction
      return tx.order.create({
        data: {
          userId,
          totalAmount,
          status: initialOrderStatus,
          transactionId: transactionId ?? null,
          commentOrder: commentOrder?.trim() || '',
          // Shipping info
          shippingName: shippingName ?? null,
          shippingAddress: shippingAddress ?? null,
          shippingCity: shippingCity ?? null,
          shippingPostalCode: shippingPostalCode ?? null,
          shippingCountry: shippingCountry ?? 'NO',
          shippingPhone: shippingPhone ?? null,
          shippingEmail: shippingEmail ?? null,
          shippingMethod: shippingMethod ?? null,
          shippingCost: shippingCost ?? null,
          Payment: {
            create: {
              commentPay: commentPay?.trim() || '',
              method: method ?? PaymentMethod.CRYPTO_NATIVE,
              status: initialPaymentStatus,
              transactionId: transactionId ?? null,
              // On-chain crypto data
              chainFamily: chainFamily ?? null,
              chainId: chainId ?? null,
              tokenSymbol: tokenSymbol ?? null,
              nativeAmount: nativeAmount ?? null,
              senderAddress: senderAddress ?? null,
              receiverAddress: receiverAddress ?? null,
              blockNumber: blockNumber ?? null,
              nokRateAtTime: nokRateAtTime ?? null,
              usdRateAtTime: usdRateAtTime ?? null,
            },
          },
          // Create order items if provided
          ...(items && items.length > 0 ? {
            OrderItem: {
              create: items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                priceAtTime: item.priceAtTime,
                title: item.title,
              })),
            },
          } : {}),
        },
        include: {
          Payment: true,
          OrderItem: true,
        },
      });
    }, {
      // Transaction options: serializable isolation prevents phantom reads / race conditions
      timeout: 15000,
      isolationLevel: 'Serializable',
    }) as Prisma.OrderGetPayload<{
      include: {
        Payment: true;
        OrderItem: true;
      };
    }>;

    // Set payment verification flag and recalculate tier
    // Fiat orders are COMPLETED immediately; crypto orders are CONFIRMING (handled in /confirm)
    if (!isCryptoPayment) {
      try {
        await dbPrisma.user.update({
          where: { id: userId },
          data: { hasWeb2Payment: true },
        });
        await recalculateVerificationTier(userId, { hasWeb2Payment: true });
      } catch (flagErr) {
        console.error('[api/orders] Failed to set hasWeb2Payment flag:', flagErr);
      }
    }

    // Generate download tokens for digital products
    let downloadTokens: Awaited<ReturnType<typeof generateDownloadTokensForOrder>> = [];
    if (items && items.length > 0) {
      try {
        const orderItemsWithIds = order.OrderItem.map((oi, idx) => ({
          id: oi.id,
          productId: items[idx]?.productId || oi.productId,
        }));
        downloadTokens = await generateDownloadTokensForOrder({
          orderId: order.id,
          userId,
          orderItems: orderItemsWithIds,
        });
      } catch (tokenError) {
        console.error('[api/orders] Failed to generate download tokens:', tokenError);
        // Don't fail the order if token generation fails
      }
    }

    // Send order confirmation email
    const emailTo = shippingEmail || session.email;
    if (emailTo) {
      try {
        await sendOrderConfirmationEmail(emailTo, {
          orderId: order.id,
          name: shippingName || 'Kunde',
          items: items ?? [],
          totalAmount,
          shippingAddress: shippingAddress ?? '',
          shippingCity: shippingCity ?? '',
          shippingPostalCode: shippingPostalCode ?? '',
          shippingCountry: shippingCountry ?? 'NO',
          transactionId: transactionId ?? undefined,
          downloadLinks: downloadTokens.length > 0 ? downloadTokens : undefined,
          shippingMethodName: shippingMethod ?? undefined,
          shippingCost: shippingCost ?? undefined,
        });
      } catch (emailError) {
        console.error('[api/orders] Failed to send confirmation email:', emailError);
        // Don't fail the order if email fails
      }
    }

    const payment = order.Payment
      ? {
          id: order.Payment.id,
          orderId: order.Payment.orderId,
          method: order.Payment.method,
          status: order.Payment.status,
          transactionId: order.Payment.transactionId ?? null,
          commentPay: order.Payment.commentPay ?? null,
          chainFamily: order.Payment.chainFamily ?? null,
          chainId: order.Payment.chainId ?? null,
          tokenSymbol: order.Payment.tokenSymbol ?? null,
          nativeAmount: order.Payment.nativeAmount ?? null,
          senderAddress: order.Payment.senderAddress ?? null,
          receiverAddress: order.Payment.receiverAddress ?? null,
          blockNumber: order.Payment.blockNumber ?? null,
          nokRateAtTime: order.Payment.nokRateAtTime ?? null,
          usdRateAtTime: order.Payment.usdRateAtTime ?? null,
          createdAt: toIsoString(order.Payment.createdAt),
          updatedAt: toIsoString(order.Payment.updatedAt),
        }
      : null;

    const dto = {
      id: order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
      status: order.status,
      transactionId: order.transactionId ?? null,
      commentOrder: order.commentOrder ?? null,
      createdAt: toIsoString(order.createdAt),
      updatedAt: toIsoString(order.updatedAt),
      Payment: payment,
      payment,
    };

    const parsed = OrderDtoSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('[api/orders] Invalid POST DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Error creating order', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    // Handle stock/transaction errors with appropriate status codes
    if (error instanceof Error) {
      if (error.message.includes('Insufficient stock')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message.includes('Product not found')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Error creating order', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
      { status: 500 }
    );
  }
}

// GET not implemented at this route; use /api/orders/[id] or /api/orders/user/[userId]
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use /api/orders/[id] or /api/orders/user/[userId]' },
    { status: 405 }
  );
}