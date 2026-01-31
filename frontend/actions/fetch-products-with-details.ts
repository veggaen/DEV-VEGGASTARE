'use server';

import { dbPrisma } from '@/lib/db';
import { User, Company } from '@prisma/client';

// Define the exact shape returned by the query instead of extending Product
interface ExtendedProduct {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  shipFromPostalId: string;
  image: string[];
  specifications: unknown;
  userId: string;
  companyId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: Pick<User, 'id' | 'name'>;
  company?: Pick<Company, 'id' | 'name'> | null;
}

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
}: FetchProductsParams): Promise<ExtendedProduct[]> => {
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
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        price: true,
        stock: true,
        shipFromPostalId: true,
        image: true,
        specifications: true,
        userId: true,
        companyId: true,
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
    // Transform Prisma field names (User/Company) to lowercase (user/company) for frontend
    return products.map((p: any) => ({
      ...p,
      user: p.User,
      company: p.Company,
    }));
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching products with details:`, error);
    return [];
  }
};