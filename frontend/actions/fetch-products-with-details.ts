'use server';

import { dbPrisma } from '@/lib/db';
import type { ProductsListItem } from '@/lib/types/products';

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length) return value;
  return new Date(String(value)).toISOString();
};

interface FetchProductsParams {
  page: number;
  perPage: number;
  categories: string[];
  minPrice: number;
  maxPrice?: number;  // make maxPrice optional
  searchTerm: string;
  sellerIds?: string[]; // Add sellerIds as an optional property
}

const LOG_PREFIX = '[frontend/actions/fetch-products-with-details.ts]';
const shouldLog = process.env.DEBUG_PRODUCTS === '1';

export const fetchProductsWithDetails = async ({
  page,
  perPage,
  categories,
  minPrice,
  maxPrice,
  searchTerm,
  sellerIds = [], // Add sellerIds with a default empty array
}: FetchProductsParams): Promise<ProductsListItem[]> => {
  if (shouldLog) {
    console.log(
      `${LOG_PREFIX} Fetching products for page ${page} with ${perPage} items per page.`
    );
    console.log(
      `${LOG_PREFIX} Parameters: categories=${categories.join(',')}, minPrice=${minPrice}, maxPrice=${maxPrice}, searchTerm=${searchTerm}, sellerIds=${sellerIds.join(',')}`
    );
  }

  try {
    const skip = (page - 1) * perPage;

    const whereClause: any = {
      price: {
        gte: minPrice,
      },
    };

    if (maxPrice !== undefined && maxPrice !== Infinity) {
      whereClause.price.lte = maxPrice;
    }

    if (categories.length > 0) {
      whereClause.category = {
        in: categories,
      };
    }

    if (searchTerm) {
      whereClause.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (sellerIds.length > 0) {
      whereClause.AND = whereClause.AND || [];
      whereClause.AND.push({
        OR: [
          { userId: { in: sellerIds } },
          { companyId: { in: sellerIds } },
        ],
      });
    }

    const products = await dbPrisma.product.findMany({
      skip,
      take: perPage,
      where: whereClause,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        price: true,
        priceCurrency: true,
        stock: true,
        shipFromPostalId: true,
        image: true,
        specifications: true,
        userId: true,
        companyId: true,
        productType: true,
        ProductAcceptedToken: {
          select: {
            symbol: true,
            family: true,
            decimals: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
          },
        },
        Company: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (shouldLog) console.log(`${LOG_PREFIX} Successfully fetched ${products.length} products.`);

    return products.map((p: any) => {
      const user = p?.User
        ? {
            id: String(p.User.id),
            name: p.User.name ?? null,
          }
        : null;

      const company = p?.Company
        ? {
            id: String(p.Company.id),
            name: String(p.Company.name),
          }
        : null;

      const dto: ProductsListItem = {
        id: String(p.id),
        title: String(p.title),
        description: String(p.description),
        category: String(p.category),
        price: typeof p.price === 'number' ? p.price : Number(p.price),
        priceCurrency: p.priceCurrency || 'USD',
        stock: typeof p.stock === 'number' ? p.stock : Number(p.stock),
        shipFromPostalId: String(p.shipFromPostalId),
        image: Array.isArray(p.image) ? p.image : [],
        specifications: (p as any).specifications ?? null,
        userId: String(p.userId),
        companyId: p.companyId ? String(p.companyId) : null,
        productType: p.productType ?? 'PHYSICAL',
        createdAt: toIsoString(p.createdAt),
        updatedAt: toIsoString(p.updatedAt),
        user,
        company,
        acceptedTokens: Array.isArray(p.ProductAcceptedToken) 
          ? p.ProductAcceptedToken.map((t: any) => ({
              symbol: t.symbol,
              family: t.family,
              decimals: t.decimals,
            }))
          : [],
      };

      return dto;
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching products with details:`, error);
    return [];
  }
};