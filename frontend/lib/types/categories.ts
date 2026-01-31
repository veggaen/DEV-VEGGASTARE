import { z } from 'zod';

export const CategoryWithCountSchema = z
  .object({
    category: z.string().min(1),
    count: z.number().int().finite(),
  })
  .strict();

export const CategoriesResponseSchema = z.array(z.string().min(1));

export const CategoriesWithCountsResponseSchema = z.array(CategoryWithCountSchema);

export type CategoryWithCount = z.infer<typeof CategoryWithCountSchema>;
export type CategoriesWithCountsResponse = z.infer<typeof CategoriesWithCountsResponseSchema>;
export type CategoriesResponse = z.infer<typeof CategoriesResponseSchema>;
