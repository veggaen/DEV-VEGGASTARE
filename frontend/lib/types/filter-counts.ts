import { z } from 'zod';

export const FilterCountsCategorySchema = z
  .object({
    category: z.string().min(1),
    count: z.number().int().nonnegative(),
  })
  .strict();

export const FilterCountsSellerSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['user', 'company']),
    count: z.number().int().nonnegative(),
  })
  .strict();

export const FilterCountsResponseSchema = z
  .object({
    categories: z.array(FilterCountsCategorySchema),
    sellers: z.array(FilterCountsSellerSchema),
  })
  .strict();

export const FilterCountsBadRequestSchema = z
  .object({
    message: z.string().min(1),
  })
  .strict();

export const FilterCountsServerErrorSchema = z
  .object({
    error: z.string().min(1),
  })
  .strict();

export type FilterCountsResponse = z.infer<typeof FilterCountsResponseSchema>;
