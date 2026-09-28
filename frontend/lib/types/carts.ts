import { z } from 'zod';
import { isPurchasableCreditAmount } from '@/lib/ai-credit-purchase';
import { MinorUnits, SettlementCurrency } from '@/lib/payments/settlement-money';

export const CartItemProductDtoSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    price: z.number().finite(),
    priceCurrency: z.string().optional(),
    image: z.array(z.string()).default([]),
    productType: z.string().optional(),
    shipFromPostalId: z.string().optional(),
    freeShippingEnabled: z.boolean().optional(),
    freeShippingThreshold: z.number().finite().nullable().optional(),
  })
  .strict();

export const CartItemDtoSchema = z
  .object({
    id: z.string().min(1),
    quantity: z.number().int().min(1),
    creditAmount: z.number().int().refine(isPurchasableCreditAmount).optional(),
    creditDiscountOre: z.number().int().nonnegative().optional(),
    creditSpendMinor: MinorUnits.positive().nullable().optional(),
    creditSpendCurrency: SettlementCurrency.nullable().optional(),
    updatedAt: z.string().datetime().optional(),
    product: CartItemProductDtoSchema,
  })
  .strict().refine(item => (item.creditSpendMinor == null) === (item.creditSpendCurrency == null), 'Incomplete credit spend');

export const CartResponseSchema = z
  .object({
    id: z.string().min(1).nullable(),
    userId: z.string().min(1),
    items: z.array(CartItemDtoSchema),
  })
  .strict();

export const CartItemResponseSchema = CartItemDtoSchema;

export const CartMessageResponseSchema = z
  .object({
    message: z.string().min(1),
  })
  .strict();

export type CartItemProductDto = z.infer<typeof CartItemProductDtoSchema>;
export type CartItemDto = z.infer<typeof CartItemDtoSchema>;
export type CartResponse = z.infer<typeof CartResponseSchema>;
export type CartMessageResponse = z.infer<typeof CartMessageResponseSchema>;
