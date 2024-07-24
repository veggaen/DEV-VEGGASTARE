'use server';

import { dbPrisma } from "@/lib/db";

const LOG_PREFIX = '[frontend/data/products.ts]';
export const getProductsByCategory = async(category: string) => {
    console.log(`${LOG_PREFIX} getProductById(${category})`);
    if(!category) return null;
    try {
        const data = await dbPrisma.product.findMany({
          where: { category },
        });

        return data
    } catch {
        return null;
    }
}

export const getProductById = async (id: string) => {
    console.log(`${LOG_PREFIX} getProductById(${id})`);
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
};

export const getProductsMany = async() => {
    console.log(`${LOG_PREFIX} getProductMany()`);
    try {
        const data = await dbPrisma.product.findMany()

        return data
    } catch {
        return null;
    }
}