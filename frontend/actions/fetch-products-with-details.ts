'use server';

import { dbPrisma } from '@/lib/db';
import { Product, User, Company } from '@prisma/client';

interface ExtendedProduct extends Product {
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
}

const LOG_PREFIX = '[frontend/actions/fetch-products-with-details.ts]';

export const fetchProductsWithDetails = async ({
  page,
  perPage,
  categories,
  minPrice,
  maxPrice,
  searchTerm,
}: FetchProductsParams): Promise<ExtendedProduct[]> => {
  console.log(`${LOG_PREFIX} Fetching products for page ${page} with ${perPage} items per page.`);
  console.log(`${LOG_PREFIX} Parameters: categories=${categories.join(',')}, minPrice=${minPrice}, maxPrice=${maxPrice}, searchTerm=${searchTerm}`);
  
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
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`${LOG_PREFIX} Successfully fetched ${products.length} products.`);
    return products;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching products with details:`, error);
    return [];
  }
};