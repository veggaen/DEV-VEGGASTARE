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

export const getProductById = async(id: string) => {
    console.log(`${LOG_PREFIX} getProductById(${id})`);
    if (!id) return null;
    try {
        const data = await dbPrisma.product.findFirst({
          where: { id }
        });

        return data
    } catch {
        return null;
    }
}