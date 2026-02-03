import { dbPrisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { CategoriesResponseSchema, CategoryCreateInputSchema } from '@/lib/types/categories';
import { auth } from '@/auth';
import { createSlug } from '@/lib/category-utils';

const isDev = process.env.NODE_ENV !== 'production';

// GET - Fetch all categories (supports both legacy string array and new model)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format'); // 'full' for new model, default for legacy
    const hierarchical = searchParams.get('hierarchical') === 'true';

    if (format === 'full') {
      // Return new Category model data
      const categories = await dbPrisma.category.findMany({
        where: hierarchical ? { parentId: null } : undefined,
        include: {
          children: hierarchical ? {
            include: {
              _count: { select: { products: true } },
            },
          } : false,
          parent: !hierarchical,
          _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
      });

      return NextResponse.json(categories);
    }

    // Legacy format - return unique category strings from products
    const products = await dbPrisma.product.findMany({
      distinct: ['category'],
      select: {
        category: true,
      },
    });

    const dto = products
      .map((cat) => cat.category)
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0);

    const parsed = CategoriesResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('[api/categories] Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Failed to fetch categories', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error('[api/categories] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

// POST - Create a new category
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CategoryCreateInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, parentId, description } = parsed.data;
    const slug = createSlug(name);

    // Check if category with same slug already exists
    const existing = await dbPrisma.category.findUnique({
      where: { slug },
      include: { parent: { select: { name: true } } },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: 'Category already exists',
          existingCategory: {
            id: existing.id,
            name: existing.name,
            slug: existing.slug,
            parentName: existing.parent?.name,
          },
        },
        { status: 409 } // Conflict
      );
    }

    // Verify parent exists if provided
    if (parentId) {
      const parent = await dbPrisma.category.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 404 });
      }
    }

    // Create the category
    const category = await dbPrisma.category.create({
      data: {
        name,
        slug,
        description: description || null,
        parentId: parentId || null,
        createdById: session.user.id,
      },
      include: {
        parent: { select: { name: true } },
        _count: { select: { products: true } },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('[api/categories] POST Error:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}