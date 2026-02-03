import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';
import { OrderDtoSchema } from '@/lib/types/orders';
import { sendOrderConfirmationEmail } from '@/lib/mail';
import { generateDownloadTokensForOrder } from '@/lib/download-tokens';

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

  const bodyResult = await parseJsonOrError(
    req,
    z.object({
      // NOTE: never trust client-supplied userId; always use session user
      totalAmount: z.coerce.number().finite().positive(),
      transactionId: z.string().trim().min(1).max(200).optional().nullable(),
      commentOrder: z.string().trim().max(2000).optional().nullable(),
      commentPay: z.string().trim().max(2000).optional().nullable(),
      method: z.nativeEnum(PaymentMethod).optional().nullable(),
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
    shippingName, shippingAddress, shippingCity, shippingPostalCode, 
    shippingCountry, shippingPhone, shippingEmail, shippingMethod, shippingCost,
    items 
  } = bodyResult.data;

  try {
    const order = await dbPrisma.order.create({
      data: {
        userId: session.id,
        totalAmount,
        status: 'COMPLETED',
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
            method: method ?? PaymentMethod.COINBASEWALLET,
            status: 'COMPLETED',
            transactionId: transactionId ?? null,
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
          userId: session.id,
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