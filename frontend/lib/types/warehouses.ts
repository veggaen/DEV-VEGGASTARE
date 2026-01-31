import { z } from 'zod';

const IsoDateStringSchema = z.string().min(1);

export const WarehouseInventoryProductDtoSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    price: z.number().finite(),
    stock: z.number().int(),
    image: z.array(z.string()).optional(),
  })
  .strict();

export const WarehouseInventoryItemDtoSchema = z
  .object({
    id: z.string().min(1),
    stock: z.number().int(),
    product: WarehouseInventoryProductDtoSchema,
  })
  .strict();

export const WarehouseLocationDtoSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1).nullable(),
    companyId: z.string().min(1).nullable(),
    postalCode: z.string().min(1),
    address: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    latitude: z.number().finite().nullable(),
    longitude: z.number().finite().nullable(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,

    // Present only for admin/owner reads
    inventory: z.array(WarehouseInventoryItemDtoSchema).optional(),
  })
  .strict();

export const WarehousesListResponseSchema = z.array(WarehouseLocationDtoSchema);

export const WarehouseProductStockDtoSchema = z
  .object({
    product: WarehouseInventoryProductDtoSchema,
    stock: z.number().int(),
  })
  .strict();

export const WarehouseDetailsResponseSchema = z
  .object({
    warehouse: WarehouseLocationDtoSchema,
    products: z.array(WarehouseProductStockDtoSchema),
  })
  .strict();

export type WarehouseLocationDto = z.infer<typeof WarehouseLocationDtoSchema>;
export type WarehousesListResponse = z.infer<typeof WarehousesListResponseSchema>;
export type WarehouseDetailsResponse = z.infer<typeof WarehouseDetailsResponseSchema>;
