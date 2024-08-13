'use server';

import { dbPrisma } from "@/lib/db";

const LOG_PREFIX = '[frontend/data/products.ts]';
export const getProductsByCategory = async (category: string) => {
    console.log(`${LOG_PREFIX} getProductsByCategory(${category})`);
    if (!category) return null;
  
    try {
      const data = await dbPrisma.product.findMany({
        where: { category },
      });
      return data;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error fetching products by category:`, error);
      return null;
    }
}

export const getProductById = async (id: string) => {
    console.log(`${LOG_PREFIX} getProductById(${id})`);
    
    try {
      const product = await dbPrisma.product.findUnique({
        where: { id },
        include: {
          inventory: true,
          company: {
            include: {
              warehouseLocations: true,
            },
          },
        },
      });
      
      console.log('getProductById() returning:', product);
      return product;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error fetching product by ID:`, error);
      return null;
    }
};

/* export const getProductsMany = async () => {
    console.log(`${LOG_PREFIX} getProductsMany()`);
    
    try {
      const data = await dbPrisma.product.findMany();
      return data;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error fetching many products:`, error);
      return null;
    }
} */

export const getProductsMany = async (page: number = 1, perPage: number = 30) => {
    console.log(`${LOG_PREFIX} getProductsMany() page: ${page}, perPage: ${perPage}`);
    try {
        const skip = (page - 1) * perPage;
        const data = await dbPrisma.product.findMany({
            skip,
            take: perPage,
            include: {
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
            },
        });
        return data;
    } catch (error) {
        console.error(`${LOG_PREFIX} Error fetching many products:`, error);
        return null;
    }
};