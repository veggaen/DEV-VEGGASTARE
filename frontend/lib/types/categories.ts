import { z } from 'zod';

// Legacy string-based categories
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

// New Category model schemas
export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  parentId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
});

export const CategoryWithChildrenSchema = CategorySchema.extend({
  children: z.lazy(() => z.array(CategorySchema)).optional(),
  parent: CategorySchema.optional().nullable(),
  _count: z.object({
    products: z.number(),
  }).optional(),
});

export const CategorySuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  similarity: z.number(), // 0-1 how close to the query
  isExactMatch: z.boolean(),
  productCount: z.number().optional(),
  parentName: z.string().optional().nullable(),
});

export const CategoryCreateInputSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  parentId: z.string().optional().nullable(),
  description: z.string().max(500).optional(),
});

export type Category = z.infer<typeof CategorySchema>;
export type CategoryWithChildren = z.infer<typeof CategoryWithChildrenSchema>;
export type CategorySuggestion = z.infer<typeof CategorySuggestionSchema>;
export type CategoryCreateInput = z.infer<typeof CategoryCreateInputSchema>;
