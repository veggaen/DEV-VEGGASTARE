import { z } from 'zod';

export const WarehouseInventoryUpdateResponseSchema = z
  .object({
    message: z.string().min(1),
  })
  .strict();
