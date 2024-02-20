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
import { getUserById } from '@/data/user';

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
    {loading && <ProductsSkeleton />}
    {products && (
      <div className={`w-full h-full grid grid-cols-2 gap-3 py-6 px-3 md:px-3 md:gap-3 ${filteredProducts?.length === 1 ? 'md:grid-cols-1' : 'md:grid-cols-3'} ${filteredProducts?.length >= 3 && products?.length >= 3 && 'xl:grid-cols-3 md:px-4 xl:gap-4'} ${filteredProducts?.length >= 4 && products?.length >= 4 && '1xl:grid-cols-4 md:px-6 1xl:gap-6'} ${filteredProducts?.length >= 5 && products?.length >= 5 && '3xl:grid-cols-5 md:px-10 3xl:gap-10'} ${filteredProducts?.length >= 6 && products?.length >= 6 && '3xl:grid-cols-6 md:px-10 3xl:gap-10'} ${filteredProducts?.length >= 7 && products?.length >= 7 && '4xl:grid-cols-7 md:px-12 4xl:gap-12'} ${filteredProducts?.length >= 8 && products?.length >= 8 && '5xl:grid-cols-8 md:px-12 5xl:gap-12'}`}>
        {filteredProducts.map((product, index) => (
          <div key={product.id.toString()} className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="flex justify-center bg-gray-100 dark:bg-gray-900">
              <Carousel>
                <CarouselContent className={`-ml-2 md:-ml-4 h-[240px] w-[300px] md:h-[288px] md:w-[360px] lg:h-[384px] lg:w-[480px] ${index % 2 === 0 ? '' : ''}`}>
                  {product.image.map((image, index) => (
                    <CarouselItem className={`pl-2 md:pl-4 ${index % 2 === 0 ? '' : ''}`} key={index}>
                      <AspectRatio ratio={5 / 4}>
                        <Image src={image} alt={product.title} fill className="object-cover" />
                      </AspectRatio>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            </div>
            <div className="flex flex-col items-center justify-center h-full bg-gray-100 dark:bg-gray-900 p-4">
              <div className="flex items-start justify-center mb-2">
                <h2 className="text-lg font-semibold text-center text-gray-800 dark:text-gray-100 mb-2 text-pretty">{product.title}</h2>
                <StarIcon className="h-5 w-5 p-1 text-gray-500 dark:text-slate-100/50"/>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 hidden md:block">{product.description.length > 200 ? `${product.description.substring(0, 200)}...` : product.description}</p>
              <div className="hidden md:flex items-center justify-between w-full">
                <p className="text-xs text-gray-500 dark:text-gray-400 text-pretty">Category: {product.category}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Shipping: Free</p>
              </div>
            </div>
            <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-900 p-4">
              <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">{`${product.price.toFixed()} $`}</p>
              <Link key={product.id.toString()} href={`/products/${product.id}`}>
                <Button variant={'vegaBuyBtn'}>View</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
  );
};
