'use client'
import React, { useState, useEffect } from 'react';
import { StarIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ProductsSkeleton from "../skeletons/products-skeleton";
import { Product } from "@prisma/client";
import { AspectRatio } from "../../ui/aspect-ratio";
import { MySidebarProductsMenu } from './sidebar';
import { useCategories } from '@/components/providers/categoriesContext';

export interface MyProductsMapProps {
  products: Product[] | null;
}

export const MyProductsMap = ({ products }: MyProductsMapProps) => {
  const [loading, setLoading] = useState(true);
  // const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // const [categories, setCategories] = useState<string[]>([]);
  const { categories, setCategories, selectedCategories, setSelectedCategories } = useCategories();
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState(Infinity);

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
    const filtered = products.filter(product =>
      (selectedCategories.length === 0 || selectedCategories.includes(product.category)) &&
      product.price >= 0 && (maxPrice === Infinity || product.price <= maxPrice)
    );
    setFilteredProducts(filtered);
  }, [selectedCategories, products, minPrice, maxPrice]);

  /* const handleCategoryChange = (category: string, isChecked: boolean) => {
    setSelectedCategories(prev =>
      isChecked ? [...prev, category] : prev.filter(c => c !== category)
    );
  }; */

  const handleResetPrice = () => {
    setMinPrice(0);
    setMaxPrice(Infinity);
  }

  return (
    <div className="w-full h-full">
      <div className='flex flex-col justify-center items-center gap-3 bg-slate-50 dark:bg-slate-950 py-4'>
        {/* <div className='grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 1xl:grid-cols-8 gap-3'>
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
        </div> */}
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
      </div>
      {loading && (
        <ProductsSkeleton />
      )}
      {products && <div className={`
      w-full h-full grid grid-cols-1 gap-3 py-6
      ${products?.length >= 2 && 'md:grid-cols-2  md:px-3 md:gap-3'}
      ${products?.length >= 3 && 'xl:grid-cols-3  md:px-4 xl:gap-4'}
      ${products?.length >= 4 && '1xl:grid-cols-4 md:px-6 1xl:gap-6'}
      ${products?.length >= 5 && '3xl:grid-cols-5 md:px-10 3xl:gap-10'}
      ${products?.length >= 6 && '3xl:grid-cols-6 md:px-10 3xl:gap-10'}
      ${products?.length >= 7 && '4xl:grid-cols-7 md:px-12 4xl:gap-12'}
      ${products?.length >= 8 && '5xl:grid-cols-8 md:px-12 5xl:gap-12'}
      `}>
        {!loading && (
          filteredProducts.map((product, index) => (
            <Link key={product.id.toString()} href={`/products/${product.id}`}>
              <div key={product.id.toString()} className={`h-fit max-w-[1280px] flex flex-col border border-transparent md:border-inherit dark:border-white/20 mx-auto p-4 transition transform duration-500 ease-in-out hover:scale-[101%] hover:border-blue-500 dark:hover:border-blue-500 md:rounded shadow-lg ${index % 2 === 0 ? 'bg-color1 light-mode dark:bg-slate-700 dark:dark-mode' : 'bg-color2 light-mode dark:bg-slate-800 dark:dark-mode'}`}>
                  <div className='flex flex-col justify-between p-4'>
                    <div className='flex'>
                      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 text-pretty">{product.title}</h2>
                      <p className='flex flex-grow justify-end'>{/* product.seller.rating */} <StarIcon className="h-5 w-5 p-1 text-gray-500 dark:text-slate-100/50"/></p>
                    </div>
                    <div className='flex'>
                      <p className="font-semibold text-gray-700 dark:text-gray-200 text-nowrap hidden 1xl:block">Category:</p>
                      <p className="font-medium text-gray-700 dark:text-gray-200 1xl:text-nowrap ml-1">{product.category}</p>
                    </div>
                  </div>
                  <div className='w-full'>
                    <AspectRatio ratio={3 / 2}>
                      <Image
                          src={product.image[0]} 
                          alt={product.title} 
                          fill
                          sizes="100%"
                          className="object-cover rounded"
                          
                      />
                    </AspectRatio>
                  </div>
                  <div className='flex flex-col justify-between p-4'>
                    <div className='mb-2'>
                      <div className="flex font-bold text-lg text-gray-800 dark:text-white">Price<p className='italic font-semibold'>{`: ${product.price.toFixed()} $`}</p></div>
                      <div className="flex font-semibold text-gray-700 dark:text-gray-200">Seller: <p className='font-serif font-medium mx-1'>{/* product.seller.name */}</p></div>
                      <div className="font-semibold text-gray-700 dark:text-gray-200">Shipping: {/* {product.shippingDetails.method} {product.shippingDetails.price} */}$</div>
                      {/* Render more details here */}
                    </div>
                    <div className='text-pretty'>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mb-4">{product.description}</p>
                    </div>
                  </div>
              </div>
            </Link>
          ))
        )}
      </div>}
    </div>
  );
};
