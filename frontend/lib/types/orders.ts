import { z } from 'zod';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@/generated/prisma/browser';

const IsoDateStringSchema = z.string().min(1);

export const PaymentDtoSchema = z
  .object({
    id: z.string().min(1),
    orderId: z.string().min(1),
    method: z.nativeEnum(PaymentMethod),
    status: z.nativeEnum(PaymentStatus),
    transactionId: z.string().nullable(),
    commentPay: z.string().nullable().optional(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
    // Crypto on-chain data
    chainFamily: z.string().nullable().optional(),
    chainId: z.number().nullable().optional(),
    tokenSymbol: z.string().nullable().optional(),
    nativeAmount: z.string().nullable().optional(),
    senderAddress: z.string().nullable().optional(),
    receiverAddress: z.string().nullable().optional(),
    blockNumber: z.number().nullable().optional(),
    nokRateAtTime: z.number().nullable().optional(),
    usdRateAtTime: z.number().nullable().optional(),
  })
  .strict();

export const OrderUserSummarySchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

export const OrderDtoSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    totalAmount: z.number().finite(),
    status: z.nativeEnum(OrderStatus),
    transactionId: z.string().nullable(),
    commentOrder: z.string().nullable().optional(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,

    // Back-compat (raw Prisma uses `Payment`)
    Payment: PaymentDtoSchema.nullable().optional(),

    // Normalized alias used by UI code
    payment: PaymentDtoSchema.nullable().optional(),

    // Back-compat (some routes include `User`)
    User: OrderUserSummarySchema.nullable().optional(),
  })
  .strict();

export const OrdersListResponseSchema = z.array(OrderDtoSchema);

export type PaymentDto = z.infer<typeof PaymentDtoSchema>;
export type OrderDto = z.infer<typeof OrderDtoSchema>;
export type OrdersListResponse = z.infer<typeof OrdersListResponseSchema>;
