
import { getProductsMany } from "@/data/products";
import { calculateSessionExpirationMyHelper } from "./helpers/vegasTimeCalculator";

const LOG_PREFIX = '[useProducts.ts]'
/**
 * @description Returns the products
 * 
 */
export const useProducts = async () => {
    const Products = await getProductsMany();
    try {
        // Call database for products, using getProductsMany()
        const uniqueProducts = await getProductsMany();

        return uniqueProducts;
      } catch (error) {
        console.error(`${LOG_PREFIX} Error fetching products:`, error);
        return null;
      }

};