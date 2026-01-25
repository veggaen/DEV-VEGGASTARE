'use server'

import { cache } from 'react';
import { dbPrisma } from '@/lib/db';
import { Product as PrismaProduct } from '@prisma/client';

// Define the Specification type based on your actual data structure
interface Specification {
  key: string;
  value: string;
}

// Extend the Product type from Prisma to adjust for frontend use
interface Product extends Omit<PrismaProduct, 'specifications'> {
  specifications: Specification[] | null; // Adjust according to your actual specifications structure
}

export const fetchProductById = cache(async (id: string): Promise<Product | null> => {
  try {
    // Fetch product data from the database
    const productData = await dbPrisma.product.findUnique({
      where: { id },
      include: {
        company: {
          include: {
            warehouseLocations: true,
          },
        },
        inventory: true,
      },
    });

    if (!productData) {
      return null;
    }

    // Parse specifications if needed
    const product: Product = {
      ...productData,
      specifications: typeof productData.specifications === 'string'
        ? JSON.parse(productData.specifications)
        : productData.specifications,
    };

    return product;
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    return null;
  }
});