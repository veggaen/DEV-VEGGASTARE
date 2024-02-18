
import { Product, SpecificationsDetails } from '@prisma/client';
import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { getProductById } from '@/data/products';
import Image from 'next/image';

// ui
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"


const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const ProductPage = async ({ params }: { params: any} ) => {
  const uid = params.id[0];
  console.log('ProductPage id:', uid)
  const product: Product | null = await getProductById(uid);
  console.log(`ProductPage[...id] product:`, product)

  if (!product) return <p>Product not found</p>;


  return (
    <div>
      {/* part one */}
      <div className={`flex justify-center`}>
        <div className='w-4/6 bg-black/30 p-6'>
          <Carousel>
            <CarouselContent className="-ml-2 md:-ml-4">
              {product.image.map((image, index) => {
                return (
                  <CarouselItem className="pl-2 md:pl-4" key={index}>
                    <Image src={image} alt={product.title} width={640} height={480} />
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      </div>

      {/* part two */}
      <div className='flex flex-col p-4 bg-black/50'>
        <h1 className='hidden'>{product.id}</h1>
        <div className='flex justify-between'>
          <h1 className='text-xl font-bold'>{product.title}</h1>
          <p className='text-xs'>{product.category}</p>
        </div>
        <div className='text-md font-semibold'>Description: {product.description}</div>
        <div>Price: {product.price}$</div>
        <div>{product.stock}</div>
      

        {/* part three */}
        <h3>Specifications:</h3>
        {Array.isArray(product.specifications) && product.specifications.length > 0 ? (
          <ul>
            {product.specifications.map((spec, index) => (
              typeof spec === 'object' && spec && Array.isArray(Object.keys(spec)) && Array.isArray(Object.values(spec)) && (
                <li key={index}>{`${Object.values(spec)[0]}: ${Object.values(spec)[1]}`}</li>
              )
            ))}
          </ul>
        ) : (
          <p>No specifications provided</p>
        )}
          <div>Updated At: {formatDate(product.updatedAt.toISOString())}</div>
          <div>Created At: {formatDate(product.createdAt.toISOString())}</div>
      </div>

    </div>
  );
};
 
export default ProductPage;