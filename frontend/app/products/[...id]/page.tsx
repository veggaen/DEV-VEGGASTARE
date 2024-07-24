

import { Product as PrismaProduct, Inventory, WarehouseLocation } from "@prisma/client";
import { getProductById } from '@/data/products';
import { MyProductSingle } from '@/components/uicustom/product/product-single';

interface Product extends Omit<PrismaProduct, 'specifications'> {
  specifications?: Specification[] | null;
  inventory: Inventory[];
  warehouseLocations: WarehouseLocation[];
}

const ProductPage = async ({ params }: { params: any }) => {
  const uid = params.id[0];
  const productData = await getProductById(uid);
  
  // Convert or cast productData to the extended Product type
  const product: Product | null = productData ? {
    ...productData,
    specifications: typeof productData.specifications === 'string' ? JSON.parse(productData.specifications) : productData.specifications,
  } : null;

  if (!product) return <p>Product not found</p>;

  return (
    <div className='w-full h-full flex flex-col justify-start items-center'>
      <MyProductSingle product={product} />
    </div>
  );
};

export default ProductPage;