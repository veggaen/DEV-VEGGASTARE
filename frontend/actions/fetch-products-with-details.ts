'use server'

import { dbPrisma } from '@/lib/db';
import { Product, User, Company } from '@prisma/client';

interface ExtendedProduct extends Product {
  user?: Pick<User, 'id' | 'name'>;
  company?: Pick<Company, 'id' | 'name'> | null;
}

export const fetchProductsWithDetails = async (): Promise<ExtendedProduct[]> => {
  try {
    const products = await dbPrisma.product.findMany({
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
    return products;
  } catch (error) {
    console.error('Error fetching products with details:', error);
    return [];
  }
};