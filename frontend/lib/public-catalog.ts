/** @fileOverview Shared visibility and availability boundary for public catalog data and facets. @stability stable */
import type { Prisma } from '@/generated/prisma/client';

export function publicCatalogWhere(): Prisma.ProductWhereInput {
  return {
    visibility: 'PUBLIC',
    OR: [
      { productType: 'DIGITAL', downloadsEnabled: true },
      { productType: 'HYBRID', downloadsEnabled: true, stock: { gt: 0 } },
      { productType: 'PHYSICAL', stock: { gt: 0 } },
    ],
  };
}
