import { z } from 'zod';

export const CartItemProductDtoSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    price: z.number().finite(),
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
    product: CartItemProductDtoSchema,
  })
  .strict();

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
