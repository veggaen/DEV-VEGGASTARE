

import { MyProductsMap } from '@/components/uicustom/product/products-map';
import { Product } from '@prisma/client';
import { getProductsMany } from '@/data/products';



const LOG_PREFIX = '[frontend/app/products/page.tsx]'
export default async function MyProductsPage(){
  const products: Product[] | null = await getProductsMany();
 if (!products) return <p>No products found</p>;
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

};
