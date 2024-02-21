

import { Product as PrismaProduct, SpecificationsDetails } from '@prisma/client';
import { getProductById } from '@/data/products';

import { MyProductSingle } from '@/components/uicustom/product/product-single';

// Extend the Product type from Prisma to adjust for the frontend use
interface Product extends Omit<PrismaProduct, 'specifications'> {
  specifications: Specification[] | null; // Adjust according to your actual specifications structure
}

// Example Specification type (adjust according to your actual data)
interface Specification {
  key: string;
  value: string;
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