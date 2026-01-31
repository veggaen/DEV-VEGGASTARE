import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import {
  FilterCountsBadRequestSchema,
  FilterCountsResponseSchema,
  FilterCountsServerErrorSchema,
} from '@/lib/types/filter-counts';

// Helper to parse comma-separated strings to arrays
function parseCommaSeparated(value: string | null, maxItems: number): string[] {
  if (!value) return [];
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, maxItems);
  return items;
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
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const selectedCategories = parseCommaSeparated(searchParams.get('selectedCategories'), 50);
    const selectedSellers = parseCommaSeparated(searchParams.get('selectedSellers'), 200);
    const minPrice = Math.max(0, Number(searchParams.get('minPrice')) || 0);
    const maxPriceRaw = searchParams.get('maxPrice');
    const maxPrice = maxPriceRaw ? Math.max(0, Number(maxPriceRaw)) : Number.POSITIVE_INFINITY;
    const searchTerm = (searchParams.get('searchTerm') || '').trim().slice(0, 200);
    
    // Runtime validation for price range
    if (maxPrice < minPrice) {
      const errorDto = { message: 'maxPrice must be >= minPrice' };
      const parsed = FilterCountsBadRequestSchema.safeParse(errorDto);
      return NextResponse.json(parsed.success ? parsed.data : errorDto, { status: 400 });
    }

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
        User: { select: { id: true, name: true } },
        Company: { select: { id: true, name: true } },
      },
    });

    // Build unique sellers map
    const sellersMap = new Map<string, { id: string; name: string; type: 'user' | 'company' }>();
    for (const p of allSellersRaw) {
      if (p.User && !sellersMap.has(p.User.id)) {
        sellersMap.set(p.User.id, { id: p.User.id, name: p.User.name ?? 'Unknown', type: 'user' });
      }
      if (p.Company && !sellersMap.has(p.Company.id)) {
        sellersMap.set(p.Company.id, { id: p.Company.id, name: p.Company.name ?? 'Unknown', type: 'company' });
      }
    }

    const sellers = Array.from(sellersMap.values()).map((s) => ({
      ...s,
      count: s.type === 'user' ? (userCountMap.get(s.id) ?? 0) : (companyCountMap.get(s.id) ?? 0),
    }));

    // Sort by count descending
    sellers.sort((a, b) => b.count - a.count);

    const dto = { categories, sellers };
    const parsed = FilterCountsResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('[API/filter-counts] Invalid response DTO:', parsed.error.issues);
      return NextResponse.json(
        {
          error: 'Invalid response shape',
          issues: process.env.NODE_ENV === 'development' ? parsed.error.issues : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error('[API/filter-counts] Error:', error);
    const errorDto = { error: 'Failed to fetch filter counts' };
    const parsed = FilterCountsServerErrorSchema.safeParse(errorDto);
    return NextResponse.json(parsed.success ? parsed.data : errorDto, { status: 500 });
  }
}

