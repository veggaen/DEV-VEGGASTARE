'use client'
import React, { useState, useEffect } from 'react';
import { StarIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ProductsSkeleton from "../skeletons/products-skeleton";
import { Product, User, Company } from "@prisma/client";
import { AspectRatio } from "../../ui/aspect-ratio";
import { useCategories } from '@/components/providers/categoriesContext';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';

interface ExtendedProduct extends Product {
  user?: Pick<User, 'id' | 'name'>;
  company?: Pick<Company, 'id' | 'name'> | null;
}

export interface MyProductsMapProps {
  products: ExtendedProduct[] | null;
}

export const MyProductsMap = ({ products }: MyProductsMapProps) => {
  const [loading, setLoading] = useState(true);
  const { categories, setCategories, selectedCategories, setSelectedCategories, minPrice, maxPrice, searchTerm } = useCategories();
  const [filteredProducts, setFilteredProducts] = useState<ExtendedProduct[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products');
        const data: ExtendedProduct[] = await response.json();
        console.log('Products:', data);
        setCategories(Array.from(new Set(data.map(product => product.category))));
        setFilteredProducts(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, [setCategories]);

  useEffect(() => {
    if (!products) return;
    let filtered = products.filter(product =>
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

  useEffect(() => {
    console.log('Filtered Products:', filteredProducts);
  }, [filteredProducts]);

  const gridClasses = `sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6`;

  return (
    <div className="w-full h-full">
      {loading && <ProductsSkeleton />}
      {products && (
        <div className={`${filteredProducts.length == 1 && 'flex justify-center'}`}>
          <div className={`grid py-6 px-2 md:px-4 ${filteredProducts.length == 1 ? 'sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1' : gridClasses} `}>
            {!loading && filteredProducts.map((product, index) => (/* hover:shadow-lg transition-shadow duration-300 rounded hover:bg-blue-500/30 p-2 */
              <div key={product.id.toString()} className={`group flex flex-col ${filteredProducts.length == 1 && 'max-w-[800px] '} hover:shadow-lg dark:hover:shadow-lg rounded overflow-hidden transition-shadow duration-100 p-2 hover:bg-blue-400/30 dark:hover:bg-blue-600/30`}>
                <div className={`relative`}>
                  <Carousel>
                    <CarouselContent>
                      {product.image.map((image, idx) => (
                        <CarouselItem key={idx}>
                          <AspectRatio ratio={5 / 4}>
                            <Image src={image} alt={product.title} fill sizes="100%" priority className="object-fill rounded" />
                          </AspectRatio>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                  </Carousel>
                </div>
                <div className="p-2 pt-4 flex flex-col justify-between flex-grow">
                  <div>
                    <h2 className="text-sm md:text-lg font-bold dark:text-indigo-400 text-indigo-600 text-pretty whitespace-break-spaces truncate">{product.title}</h2>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 italic truncate">{product.category}</p>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 truncate">{product.description}</p>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 italic truncate">
                      Seller: {product.company ? product.company.name : product.user?.name}
                    </p>
                  </div>
                  <div className="flex justify-between items-center my-2 sm:mt-4 gap-2">
                    <div className="flex items-center">
                      <StarIcon className="h-5 w-5 text-yellow-500" />
                    </div>
                    <p className="text-md font-semibold">{`${product.price.toFixed(0)} $`}</p>
                  </div>
                  <Link href={`/products/${product.id}`} passHref className='w-full'>
                    <Button variant='vegaNormalBtn' className="bg-white/10 dark:bg-black/10 border-gray-500/20 dark:border-slate-700/20 font-semibold w-full">View</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};