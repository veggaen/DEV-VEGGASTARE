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

  const gridClasses = `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5`;
  return (
    <div className="w-full h-full">
    {loading && <ProductsSkeleton />}
    {products && (
      <div className={`grid gap-3 py-6 px-2 md:px-4 ${gridClasses}`}>
        {!loading && filteredProducts.map((product, index) => (
          <div key={product.id.toString()} className="flex flex-col border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="relative">
              <Carousel>
                <CarouselContent>
                  {product.image.map((image, idx) => (
                    <CarouselItem key={idx}>
                      <AspectRatio ratio={3 / 2}>
                        <Image src={image} alt={product.title} layout="fill" className="object-cover" />
                      </AspectRatio>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            </div>
            <div className="p-4 flex flex-col justify-between flex-grow bg-gray-100 dark:bg-gray-800">
              <div>
                <h2 className="text-sm md:text-lg font-bold whitespace-break-spaces truncate">{product.title}</h2>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 italic truncate">{product.category}</p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 truncate">{product.description}</p>
              </div>
              <div className="flex justify-between items-center mt-2 sm:mt-4">
                <div className="flex items-center">
                  <StarIcon className="h-5 w-5 text-yellow-500" />
                  {/* Placeholder for future rating display */}
                </div>
                <p className="text-md font-semibold">{`${product.price.toFixed(0)} $`}</p>
              </div>
              <Link href={`/products/${product.id}`} passHref>
                <Button variant="vegaBuyBtn" className="mt-2 sm:mt-4 text-xs md:text-sm">View</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
  );
};
