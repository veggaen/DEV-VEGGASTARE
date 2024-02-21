

import { Product } from '@prisma/client';
import { getProductById } from '@/data/products';

import { MyProductSingle } from '@/components/uicustom/product/product-single';


const ProductPage = async ({ params }: { params: any} ) => {
  const uid = params.id[0];
  console.log('ProductPage id:', uid)
  const product: Product | null = await getProductById(uid);
  console.log(`ProductPage[...id] product:`, product)

  if (!product) return <p>Product not found</p>;


  return (
    <div className='w-full h-full flex flex-col justify-start items-center'>
      <MyProductSingle product={product} />
    </div>
  );
};
 
export default ProductPage;