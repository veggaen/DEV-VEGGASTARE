import { dbPrisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { CategorySuggestion } from '@/lib/types/categories';
import { normalizeForMatching, createSlug, calculateSimilarity } from '@/lib/category-utils';

// GET /api/categories/suggest?q=query
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    if (!query || query.length < 1) {
      // Return popular categories if no query
      const popularCategories = await dbPrisma.category.findMany({
        take: limit,
        orderBy: {
          products: {
            _count: 'desc',
          },
        },
        include: {
          _count: {
            select: { products: true },
          },
          parent: {
            select: { name: true },
          },
        },
      });

      const suggestions: CategorySuggestion[] = popularCategories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        similarity: 1,
        isExactMatch: false,
        productCount: cat._count.products,
        parentName: cat.parent?.name,
      }));

      return NextResponse.json(suggestions);
    }

    // Get all categories for fuzzy matching
    const allCategories = await dbPrisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
        parent: {
          select: { name: true },
        },
      },
    });

    // Calculate similarity for each category
    const scoredCategories = allCategories.map((cat) => ({
      ...cat,
      similarity: calculateSimilarity(query, cat.name),
      isExactMatch: normalizeForMatching(query) === normalizeForMatching(cat.name),
    }));

    // Filter out low-similarity matches and sort by similarity
    const threshold = 0.3;
    const suggestions: CategorySuggestion[] = scoredCategories
      .filter((cat) => cat.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        similarity: cat.similarity,
        isExactMatch: cat.isExactMatch,
        productCount: cat._count.products,
        parentName: cat.parent?.name,
      }));

    // Also include slug-based matching suggestion
    const querySlug = createSlug(query);
    const slugMatch = allCategories.find((cat) => cat.slug === querySlug);
    
    if (slugMatch && !suggestions.find((s) => s.id === slugMatch.id)) {
      suggestions.unshift({
        id: slugMatch.id,
        name: slugMatch.name,
        slug: slugMatch.slug,
        similarity: 0.95,
        isExactMatch: true,
        productCount: slugMatch._count.products,
        parentName: slugMatch.parent?.name,
      });
    }

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('[api/categories/suggest] Error:', error);
    return NextResponse.json({ error: 'Failed to get suggestions' }, { status: 500 });
  }
}
