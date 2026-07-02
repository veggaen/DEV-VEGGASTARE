import { NextResponse } from 'next/server';
import { PaymentMethod, PaymentStatus, ChainFamily } from '@/generated/prisma/browser';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { OrderDtoSchema } from '@/lib/types/orders';
import { z } from 'zod';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

const OrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  priceAtTime: z.coerce.number().nonnegative(),
  title: z.string().min(1).max(500),
});

const blankStringToNull = (schema: z.ZodString): z.ZodType<string | null | undefined, z.ZodTypeDef, unknown> =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    schema.optional().nullable()
  );

type CreatedPayment = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId: string | null;
  commentPay: string | null;
  chainFamily: ChainFamily | null;
  chainId: number | null;
  tokenSymbol: string | null;
  nativeAmount: string | null;
  senderAddress: string | null;
  receiverAddress: string | null;
  blockNumber: number | null;
  nokRateAtTime: number | null;
  usdRateAtTime: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function POST(req: Request) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.id;

  const bodyResult = await parseJsonOrError(
    req,
    z.object({
      totalAmount: z.coerce.number().finite().positive(),
      transactionId: z.string().trim().min(1).max(200).optional().nullable(),
      commentOrder: z.string().trim().max(2000).optional().nullable(),
      commentPay: z.string().trim().max(2000).optional().nullable(),
      method: z.nativeEnum(PaymentMethod).optional().nullable(),
      chainFamily: z.nativeEnum(ChainFamily).optional().nullable(),
      chainId: z.coerce.number().int().optional().nullable(),
      tokenSymbol: z.string().trim().max(20).optional().nullable(),
      nativeAmount: z.string().trim().max(100).optional().nullable(),
      senderAddress: z.string().trim().max(200).optional().nullable(),
      receiverAddress: z.string().trim().max(200).optional().nullable(),
      blockNumber: z.coerce.number().int().optional().nullable(),
      nokRateAtTime: z.coerce.number().optional().nullable(),
      usdRateAtTime: z.coerce.number().optional().nullable(),
      shippingName: blankStringToNull(z.string().trim().min(2).max(200)),
      shippingAddress: blankStringToNull(z.string().trim().min(3).max(500)),
      shippingCity: blankStringToNull(z.string().trim().min(2).max(100)),
      shippingPostalCode: blankStringToNull(z.string().trim().min(4).max(10)),
      shippingCountry: z.string().trim().length(2).default('NO'),
      shippingPhone: blankStringToNull(z.string().trim().max(20)),
      shippingEmail: blankStringToNull(z.string().email()),
      shippingMethod: blankStringToNull(z.string().trim().max(100)),
      shippingCost: z.coerce.number().nonnegative().optional().nullable(),
      items: z.array(OrderItemSchema).optional(),
    })
  );
  if (!bodyResult.ok) return bodyResult.response;

  const {
    totalAmount,
    transactionId,
    commentOrder,
    commentPay,
    method,
    chainFamily,
    chainId,
    tokenSymbol,
    nativeAmount,
    senderAddress,
    receiverAddress,
    blockNumber,
    nokRateAtTime,
    usdRateAtTime,
    shippingName,
    shippingAddress,
    shippingCity,
    shippingPostalCode,
    shippingCountry,
    shippingPhone,
    shippingEmail,
    shippingMethod,
    shippingCost,
    items,
  } = bodyResult.data;
  const normalizedShippingName = typeof shippingName === 'string' ? shippingName : null;
  const normalizedShippingAddress = typeof shippingAddress === 'string' ? shippingAddress : null;
  const normalizedShippingCity = typeof shippingCity === 'string' ? shippingCity : null;
  const normalizedShippingPostalCode = typeof shippingPostalCode === 'string' ? shippingPostalCode : null;
  const normalizedShippingPhone = typeof shippingPhone === 'string' ? shippingPhone : null;
  const normalizedShippingEmail = typeof shippingEmail === 'string' ? shippingEmail : null;
  const normalizedShippingMethod = typeof shippingMethod === 'string' ? shippingMethod : null;

  let serverTotal = 0;
  const productMap = new Map<string, { id: string; price: number; stock: number; title: string; productType: string }>();
  let hasPhysicalItems = false;

  if (items && items.length > 0) {
    const productIds = items.map((i) => i.productId);
    const products = await dbPrisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true, stock: true, title: true, productType: true },
    });

    for (const product of products) {
      productMap.set(product.id, product);
    }

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 }
        );
      }

      if (Math.abs(Number(product.price) - item.priceAtTime) > 0.02) {
        return NextResponse.json(
          { error: `Price mismatch for "${product.title}": expected ${product.price}, got ${item.priceAtTime}` },
          { status: 400 }
        );
      }

      serverTotal += Number(product.price) * item.quantity;
      if (product.productType !== 'DIGITAL') {
        hasPhysicalItems = true;
      }
    }

    const shippingAddon = shippingCost ?? 0;
    if (Math.abs(serverTotal + shippingAddon - totalAmount) > 1.0) {
      console.warn(`[api/orders] Total mismatch: server=${serverTotal} + shipping=${shippingAddon}, client=${totalAmount}`);
    }
  }

  if (hasPhysicalItems) {
    if (!normalizedShippingAddress || !normalizedShippingCity || !normalizedShippingPostalCode) {
      return NextResponse.json(
        { error: 'Shipping address is required for physical products' },
        { status: 400 }
      );
    }

    if (!normalizedShippingMethod) {
      return NextResponse.json(
        { error: 'Shipping method is required for physical products' },
        { status: 400 }
      );
    }
  }

  const isCryptoPayment = !!chainFamily || method === PaymentMethod.CRYPTO_NATIVE;
  const isFiatProvider = method === PaymentMethod.PAYPAL || method === PaymentMethod.VIPPS || method === PaymentMethod.KLARNA;
  const initialOrderStatus = isCryptoPayment ? 'CONFIRMING' : (isFiatProvider ? 'PENDING' : 'COMPLETED');
  const initialPaymentStatus = isCryptoPayment ? 'CONFIRMING' : (isFiatProvider ? 'PENDING' : 'COMPLETED');

  try {
    const order = await dbPrisma.$transaction(async (tx) => {
      if (items && items.length > 0) {
        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true, stock: true, title: true, productType: true },
          });

          if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
          }

          if (product.productType !== 'DIGITAL' && product.stock < item.quantity) {
            throw new Error(`Insufficient stock for "${product.title}": only ${product.stock} available`);
          }

          if (product.productType !== 'DIGITAL') {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
            });
          }
        }
      }

      return tx.order.create({
        data: {
          userId,
          totalAmount,
          status: initialOrderStatus,
          transactionId: transactionId ?? null,
          commentOrder: commentOrder?.trim() || '',
          shippingName: normalizedShippingName,
          shippingAddress: normalizedShippingAddress,
          shippingCity: normalizedShippingCity,
          shippingPostalCode: normalizedShippingPostalCode,
          shippingCountry: shippingCountry ?? 'NO',
          shippingPhone: normalizedShippingPhone,
          shippingEmail: normalizedShippingEmail,
          shippingMethod: normalizedShippingMethod,
          shippingCost: shippingCost ?? null,
          Payment: {
            create: {
              commentPay: commentPay?.trim() || '',
              method: method ?? PaymentMethod.CRYPTO_NATIVE,
              status: initialPaymentStatus,
              transactionId: transactionId ?? null,
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
          ...(items && items.length > 0
            ? {
                OrderItem: {
                  create: items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    priceAtTime: item.priceAtTime,
                    title: item.title,
                  })),
                },
              }
            : {}),
        },
        include: {
          Payment: true,
          OrderItem: true,
        },
      });
    }, {
      timeout: 15000,
      isolationLevel: 'Serializable',
    });
    const orderWithPayment = order as typeof order & { Payment: CreatedPayment | null };

    try {
      const notifTitle = isCryptoPayment
        ? 'Order pending blockchain confirmation'
        : isFiatProvider
          ? 'Order placed - payment pending'
          : 'Order confirmed';
      const notifMessage = isCryptoPayment
        ? `Order ${order.id.slice(0, 8)} is waiting for blockchain confirmation.`
        : isFiatProvider
          ? `Order ${order.id.slice(0, 8)} is waiting for payment confirmation.`
          : `Order ${order.id.slice(0, 8)} is confirmed.`;

      await dbPrisma.notification.create({
        data: {
          userId,
          type: 'SYSTEM',
          title: notifTitle,
          message: notifMessage,
          preview: `Order #${order.id.slice(0, 8)} - ${items?.length ?? 0} item(s) - ${totalAmount}`,
          metadata: {
            orderId: order.id,
            orderStatus: order.status,
            paymentStatus: orderWithPayment.Payment?.status ?? null,
            isCryptoPayment,
            isFiatProvider,
            stockReserved: true,
          },
        },
      });
    } catch (notificationError) {
      console.error('[api/orders] Failed to create order notification:', notificationError);
    }

    const payment = orderWithPayment.Payment
      ? {
          id: orderWithPayment.Payment.id,
          orderId: orderWithPayment.Payment.orderId,
          method: orderWithPayment.Payment.method,
          status: orderWithPayment.Payment.status,
          transactionId: orderWithPayment.Payment.transactionId ?? null,
          commentPay: orderWithPayment.Payment.commentPay ?? null,
          chainFamily: orderWithPayment.Payment.chainFamily ?? null,
          chainId: orderWithPayment.Payment.chainId ?? null,
          tokenSymbol: orderWithPayment.Payment.tokenSymbol ?? null,
          nativeAmount: orderWithPayment.Payment.nativeAmount ?? null,
          senderAddress: orderWithPayment.Payment.senderAddress ?? null,
          receiverAddress: orderWithPayment.Payment.receiverAddress ?? null,
          blockNumber: orderWithPayment.Payment.blockNumber ?? null,
          nokRateAtTime: orderWithPayment.Payment.nokRateAtTime ?? null,
          usdRateAtTime: orderWithPayment.Payment.usdRateAtTime ?? null,
          createdAt: toIsoString(orderWithPayment.Payment.createdAt),
          updatedAt: toIsoString(orderWithPayment.Payment.updatedAt),
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
    if (error instanceof Error) {
      if (error.message.includes('Insufficient stock')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message.includes('Product not found')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error('[api/orders] Error creating order:', error);
    return NextResponse.json(
      { error: 'Error creating order', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use /api/orders/[id] or /api/orders/user/[userId]' },
    { status: 405 }
  );
}
