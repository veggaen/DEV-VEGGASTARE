'use server'

import { MyProductsMap } from '@/components/uicustom/product/products-map';
import { Product } from '@prisma/client';
import { useProducts } from '@/hooks/use-products';
import { useCategories } from '@/components/providers/categoriesContext';


const LOG_PREFIX = '[frontend/app/products/page.tsx]'
const MyProductsPage = async () => {
  const products: Product[] | null = await useProducts();
  try {

    return (
      <div className={`space-y-4 w-full overflow-y-auto`}>
        <div className='flex flex-col justify-center items-center'>
          <h1 className='text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-bl dark:from-slate-300 from-slate-500 dark:to-slate-300 to-slate-900 text-pretty'>Products Page</h1>
        </div>
        <div className='w-full h-full'>
          {products && <MyProductsMap products={products} />}
        </div>
      </div>
    );
    
  } catch {
    console.error(`${LOG_PREFIX} useProducts() Error fetching products`);
  }
};
  
  export default MyProductsPage;