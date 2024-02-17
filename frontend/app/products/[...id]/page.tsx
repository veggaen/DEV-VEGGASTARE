'use client'

import { Product } from '@prisma/client';
import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';

const ProductPage = () => {
  const { id } = useParams(); // Get the product ID from the URL
  console.log('ProductPage id:', id)
  const [product, setProduct] = useState<Product>();
  console.log('ProductPage product:', product)
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (id) { // Ensure id is not undefined
      setIsLoading(true);
      fetch(`/api/products/${id}`)
        .then((res) => res.json())
        .then((data) => {
          setProduct(data);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('Error fetching product:', error);
          setIsLoading(false);
        });
    }
  }, [id]);

  if (isLoading) return <p>Loading...</p>;
  if (!product) return <p>Product not found</p>;

  return (
    <div>
      <h1>{product.title}</h1>
      <p>{product.description}</p>
      {/* Display more product details here */}
    </div>
  );
};

export default ProductPage;