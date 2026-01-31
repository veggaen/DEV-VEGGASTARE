import { z } from 'zod';

const IsoDateStringSchema = z.string().min(1);

export const SellerWithCountSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['user', 'company']),
    count: z.number().int().finite(),
  })
  .strict();

export const SellersResponseSchema = z.array(SellerWithCountSchema);

export const ProductUserSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
  })
  .strict();

export const ProductCompanySummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

export const ProductsListItemSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string(),
    category: z.string(),
    price: z.number().finite(),
    stock: z.number().int().finite(),
    shipFromPostalId: z.string(),
    image: z.array(z.string()),
    specifications: z.unknown().nullable().optional(),
    userId: z.string().min(1),
    companyId: z.string().nullable().optional(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,

    // Normalized fields used by frontend
    user: ProductUserSummarySchema.nullable().optional(),
    company: ProductCompanySummarySchema.nullable().optional(),

    // Back-compat with raw Prisma select casing
    User: ProductUserSummarySchema.nullable().optional(),
    Company: ProductCompanySummarySchema.nullable().optional(),
  })
  .strict();

export const ProductsListResponseSchema = z.array(ProductsListItemSchema);

export const ProductWarehouseLocationSchema = z
  .object({
    id: z.string().min(1),
    country: z.string().min(1),
    postalCode: z.string().min(1),
  })
  .strict();

export const ProductInventoryItemSchema = z
  .object({
    id: z.string().min(1),
    stock: z.number().int().finite(),
    warehouseId: z.string().min(1),
  })
  .strict();

export const ProductSpecificationSchema = z
  .object({
    key: z.string(),
    value: z.string(),
  })
  .strict();

export const ProductDetailsResponseSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string(),
    category: z.string(),
    price: z.number().finite(),
    image: z.array(z.string()),
    specifications: z.array(ProductSpecificationSchema).nullable(),
    company: z
      .object({
        warehouseLocations: z.array(ProductWarehouseLocationSchema).nullable(),
      })
      .nullable(),
    inventory: z.array(ProductInventoryItemSchema),
    shipFromPostalId: z.string(),
    updatedAt: IsoDateStringSchema,
    createdAt: IsoDateStringSchema,
  })
  .strict();

export const TitlesResponseSchema = z.array(z.string().min(1));

export const PriceRangeResponseSchema = z
  .object({
    min: z.number().finite(),
    max: z.number().finite(),
  })
  .strict();

export type SellerWithCount = z.infer<typeof SellerWithCountSchema>;
export type ProductsListItem = z.infer<typeof ProductsListItemSchema>;
export type ProductDetailsResponse = z.infer<typeof ProductDetailsResponseSchema>;
export type TitlesResponse = z.infer<typeof TitlesResponseSchema>;
export type PriceRangeResponse = z.infer<typeof PriceRangeResponseSchema>;
