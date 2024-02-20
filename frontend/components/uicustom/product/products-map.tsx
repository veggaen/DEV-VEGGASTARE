'use client'
import React, { useState, useEffect } from 'react';
import { StarIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ProductsSkeleton from "../skeletons/products-skeleton";
import { Product } from "@prisma/client";
import { AspectRatio } from "../../ui/aspect-ratio";
import { useCategories } from '@/components/providers/categoriesContext';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';

export interface MyProductsMapProps {
  products: Product[] | null;
}

export const MyProductsMap = ({ products }: MyProductsMapProps) => {
  const [loading, setLoading] = useState(true);
  // const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // const [categories, setCategories] = useState<string[]>([]);
  const { categories, setCategories, selectedCategories, setSelectedCategories, minPrice, maxPrice, searchTerm } = useCategories();
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  // Extract categories from products
  useEffect(() => {
    if (products) {
      const uniqueCategories = Array.from(new Set(products.map(product => product.category)));
      setCategories(uniqueCategories);
      setFilteredProducts(products);
      setLoading(false);
    }
  }, [products, setCategories]);

  // Update filtered products when selected categories change
  useEffect(() => {
    if (!products) return;
    var filtered = products.filter(product =>
      (selectedCategories.length === 0 || selectedCategories.includes(product.category)) &&
      product.price >= minPrice && (maxPrice === Infinity || product.price <= maxPrice)
    );
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredProducts(filtered);
  }, [selectedCategories, products, minPrice, maxPrice, searchTerm]);

  return (
    <div className="w-full h-full">
      {/* <div className='flex flex-col justify-center items-center gap-3 bg-slate-50 dark:bg-slate-950 py-4'>
        <div className='grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 1xl:grid-cols-8 gap-3'>
          {categories.map((category) => (
            <div key={category} className={`bg-black/30 py-1 px-2 rounded`}>
              <div className={`flex`} >
                <input
                  className={'mx-1'}
                  type="checkbox"
                  id={category}
                  name={category}
                  onChange={(e) => handleCategoryChange(category, e.target.checked)}
                />
                <label htmlFor={category}>{category}</label>
              </div>
            </div>
          ))}
        </div>
        <div className={'flex flex-col sm:flex-row justify-center items-center w-fit gap-0 bg-slate-100 dark:bg-slate-900 py-2 px-2 rounded'}>
          <input
            type="number"
            placeholder="Min Price"
            value={minPrice !== 0 ? minPrice.toString() : ''}
            onChange={(e) => setMinPrice(e.target.value ? parseInt(e.target.value) : 0)}
            className={'w-full border-2 p-1 sm:mr-2'}
          />
          <input
            type="number"
            placeholder="Max Price"
            value={maxPrice !== Infinity ? maxPrice.toString() : ''}
            onChange={(e) => setMaxPrice(e.target.value ? parseInt(e.target.value) : Infinity)}
            className={'border-2 p-1 w-full sm:mr-2'}
          />
          <div onClick={handleResetPrice} className='bg-black/30 w-full py-1 px-2 border-2 rounded-r hover:bg-blue-500 '>Reset</div>
        </div>
      </div> */}
      {loading && (
        <ProductsSkeleton />
      )}
      {products && <div className={`
      w-full h-full grid grid-cols-1 gap-3 py-6 px-3
      ${filteredProducts?.length >= 2 && products?.length >= 2 && 'md:grid-cols-2  md:px-3 md:gap-3'}
      ${filteredProducts?.length >= 3 && products?.length >= 3 && 'xl:grid-cols-3  md:px-4 xl:gap-4'}
      ${filteredProducts?.length >= 4 && products?.length >= 4 && '1xl:grid-cols-4 md:px-6 1xl:gap-6'}
      ${filteredProducts?.length >= 5 && products?.length >= 5 && '3xl:grid-cols-5 md:px-10 3xl:gap-10'}
      ${filteredProducts?.length >= 6 && products?.length >= 6 && '3xl:grid-cols-6 md:px-10 3xl:gap-10'}
      ${filteredProducts?.length >= 7 && products?.length >= 7 && '4xl:grid-cols-7 md:px-12 4xl:gap-12'}
      ${filteredProducts?.length >= 8 && products?.length >= 8 && '5xl:grid-cols-8 md:px-12 5xl:gap-12'}
      `}>
        {!loading && (
          filteredProducts.map((product, index) => (
              <div key={product.id.toString()} className={`h-full w-full max-w-[886px] flex flex-col gap-1 border border-black/50 md:border-black/50 dark:border-white/20 mx-auto transition duration-500 ease-in-out hover:border-blue-500 dark:hover:border-blue-500 rounded-lg shadow-lg ${index % 2 === 0 ? 'bg-color1 light-mode bg-slate-100 hover:bg-slate-50 dark:bg-slate-700 dark:dark-mode' : 'bg-color2 light-mode bg-slate-200 dark:bg-slate-800 dark:dark-mode'} overflow-hidden`}>
                  <div className='flex flex-col justify-between py-4 px-2 bg-gray-300 dark:bg-gray-900'>
                      <div className='flex text-xs'>
                        <p className="font-semibold text-gray-700 dark:text-gray-200 text-nowrap hidden 1xl:block">Category:</p>
                        <p className="font-medium text-gray-700 dark:text-gray-200 1xl:text-nowrap ml-1">{product.category}</p>
                      </div>
                    <div className='flex'>
                      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 text-pretty">{product.title}</h2>
                      <p className='flex flex-grow justify-end'>{/* product.seller.rating */} <StarIcon className="h-5 w-5 p-1 text-gray-500 dark:text-slate-100/50"/></p>
                    </div>
                  </div>
                  <div className='w-full h-full flex flex-col justify-between p-4'>
                    <div className='w-full'>
                      <Carousel>
                        <CarouselContent className="-ml-2 md:-ml-4">
                          {product.image.map((image, index) => (
                            <CarouselItem className="pl-2 md:pl-4" key={index}>
                              <AspectRatio ratio={3 / 2}>
                                <Image src={image} alt={product.title} width={640} height={480} layout="responsive" className='rounded' />
                              </AspectRatio>
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                        <CarouselPrevious />
                        <CarouselNext />
                      </Carousel>
                      <div className='w-full text-gray-800 dark:text-white'>
                        <div className="flex flex-col justify-between py-1 bg-gray-300 dark:bg-gray-900 border border-white/20 dark:border-black/20 border-t-transparent rounded-b">
                          <span className='relative left-2 text-xs leading-none italic'>Description:</span>
                          <p className='font-light py-2 px-4 rounded'>{product.description}</p>
                        </div>
                        <div className="flex justify-between py-1 px-2 rounded">
                          <p className='font-bold text-lg'>Price: </p>
                          <p className='italic font-semibold'>{`${product.price.toFixed()} $`}</p>
                        </div>
                        <div className="flex justify-between py-1 px-2 rounded">
                          <p className='font-bold text-lg'>Shipping: </p>
                          <p className='italic font-semibold'>{/* {product.shippingDetails.method} {product.shippingDetails.price} */}$</p>
                        </div>
                        <div className="flex justify-between py-1 px-2 rounded">
                          <p className='font-bold text-lg'>Seller: </p>
                          <p className='italic font-semibold'>{/* product.seller.name */}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                    <div className='flex flex-col py-2 px-4 bg-gray-300 dark:bg-gray-900'>
                        <Link key={product.id.toString()} href={`/products/${product.id}`}>
                          <Button variant={'vegaBuyBtn'} className={`w-full`}>View</Button>
                        </Link>
                      <div className='flex justify-end py-2 w-full gap-3'>
                        <Button variant={'vegaAddBasketBtn'} className={`w-full`}>Add to Basket</Button>
                        <Button variant={'vegaAddWishlistBtn'} className={`w-full`}>Add to Wishlist</Button>
                      </div>
                    </div>
              </div>
          ))
        )}
      </div>}
    </div>
  );
};
