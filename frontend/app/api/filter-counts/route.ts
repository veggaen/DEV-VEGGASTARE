import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';

export interface FilterCountsResponse {
  categories: { category: string; count: number }[];
  sellers: { id: string; name: string; type: 'user' | 'company'; count: number }[];
}

/**
 * Returns category and seller counts filtered by current selections.
 * Query params:
 * - selectedCategories: comma-separated category names
 * - selectedSellers: comma-separated seller IDs (user or company)
 * - minPrice, maxPrice: price range
 * - searchTerm: text search
 */
export async function GET(request: Request) {
  try {
    const queryResult = parseQueryOrError(
      request,
      z
        .object({
          selectedCategories: z
            .preprocess(
              (v) =>
                typeof v === 'string'
                  ? v
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : [],
              z.array(z.string().min(1).max(100)).max(50)
            )
            .optional()
            .default([]),
          selectedSellers: z
            .preprocess(
              (v) =>
                typeof v === 'string'
                  ? v
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : [],
              z.array(z.string().min(1).max(200)).max(200)
            )
            .optional()
            .default([]),
          minPrice: z.coerce.number().min(0).optional().default(0),
          maxPrice: z
            .preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().min(0))
            .optional()
            .default(Number.POSITIVE_INFINITY),
          searchTerm: z.string().trim().max(200).optional().default(''),
        })
        .refine((v) => v.maxPrice >= v.minPrice, { message: 'maxPrice must be >= minPrice' })
    );
    if (!queryResult.ok) return queryResult.response;
    const { selectedCategories, selectedSellers, minPrice, maxPrice, searchTerm } = queryResult.data;

    // Build base where clause (excluding the dimension we're counting)
    const baseWhere: any = {
      price: { gte: minPrice },
    };
    if (Number.isFinite(maxPrice)) {
      baseWhere.price.lte = maxPrice;
    }
    if (searchTerm) {
      baseWhere.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // --- Category counts (filtered by selected sellers) ---
    const categoryWhere = { ...baseWhere };
    if (selectedSellers.length > 0) {
      categoryWhere.AND = [
        { OR: [{ userId: { in: selectedSellers } }, { companyId: { in: selectedSellers } }] },
      ];
    }

    const categoryCounts = await dbPrisma.product.groupBy({
      by: ['category'],
      where: categoryWhere,
      _count: { id: true },
    });

    // Get all categories (even those with 0 count when filtered)
    const allCategories = await dbPrisma.product.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const categoryCountMap = new Map(categoryCounts.map((c) => [c.category, c._count.id]));
    const categories = allCategories.map((c) => ({
      category: c.category,
      count: categoryCountMap.get(c.category) ?? 0,
    }));

    // --- Seller counts (filtered by selected categories) ---
    const sellerWhere: any = { ...baseWhere };
    if (selectedCategories.length > 0) {
      sellerWhere.category = { in: selectedCategories };
    }

    // Count by userId
    const userCounts = await dbPrisma.product.groupBy({
      by: ['userId'],
      where: sellerWhere,
      _count: { id: true },
    });

    // Count by companyId
    const companyCounts = await dbPrisma.product.groupBy({
      by: ['companyId'],
      where: { ...sellerWhere, companyId: { not: null } },
      _count: { id: true },
    });

    const userCountMap = new Map(userCounts.map((u) => [u.userId, u._count.id]));
    const companyCountMap = new Map(companyCounts.map((c) => [c.companyId, c._count.id]));

    // Get all sellers for names
    const allUserIds = [...new Set(userCounts.map((u) => u.userId))];
    const allCompanyIds = [...new Set(companyCounts.map((c) => c.companyId).filter((id): id is string => id !== null))];

    // Also get sellers that might have 0 count (from full list)
    const allSellersRaw = await dbPrisma.product.findMany({
      distinct: ['userId', 'companyId'],
      select: {
        userId: true,
        companyId: true,
        user: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
      },
    });

    // Build unique sellers map
    const sellersMap = new Map<string, { id: string; name: string; type: 'user' | 'company' }>();
    for (const p of allSellersRaw) {
      if (p.user && !sellersMap.has(p.user.id)) {
        sellersMap.set(p.user.id, { id: p.user.id, name: p.user.name ?? 'Unknown', type: 'user' });
      }
      if (p.company && !sellersMap.has(p.company.id)) {
        sellersMap.set(p.company.id, { id: p.company.id, name: p.company.name, type: 'company' });
      }
    }

    const sellers = Array.from(sellersMap.values()).map((s) => ({
      ...s,
      count: s.type === 'user' ? (userCountMap.get(s.id) ?? 0) : (companyCountMap.get(s.id) ?? 0),
    }));

    // Sort by count descending
    sellers.sort((a, b) => b.count - a.count);

    return NextResponse.json({ categories, sellers } as FilterCountsResponse);
  } catch (error) {
    console.error('[API/filter-counts] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch filter counts' }, { status: 500 });
  }
}

