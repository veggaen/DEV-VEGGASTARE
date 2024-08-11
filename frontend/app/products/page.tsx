'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PanelLeftClose, PanelLeftOpen, StarIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ProductsSkeleton from '@/components/uicustom/skeletons/products-skeleton';
import { Product, User, Company } from "@prisma/client";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useCategories } from '@/components/providers/categoriesContext';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useInView } from 'react-intersection-observer';
import Spinner from '@/components/uicustom/spinner';
import debounce from 'lodash.debounce';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useSidebar } from '@/components/providers/product-layoutProvider';

interface ExtendedProduct extends Product {
  user?: Pick<User, 'id' | 'name'>;
  company?: Pick<Company, 'id' | 'name'> | null;
}

const LOG_PREFIX = 'frontend/app/products/page.tsx';

const ProductCard = React.memo(({ product }: { product: ExtendedProduct }) => (
  <div className="group flex flex-col hover:shadow-lg dark:hover:shadow-lg rounded overflow-hidden transition-shadow duration-100 p-2 hover:bg-blue-400/30 dark:hover:bg-blue-600/30">
    <div className="relative">
      <Carousel>
        <CarouselContent>
          {product.image.map((image, idx) => (
            <CarouselItem key={idx}>
              <AspectRatio ratio={1 / 1}>
                <Image src={image} alt={product.title} sizes="100%" width={500} height={500} priority={idx === 0} className="object-fill rounded" />
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
));

ProductCard.displayName = 'ProductCard';

export default function MyProductsPage() {
  const [loading, setLoading] = useState(true);
  const { categories, setCategories, selectedCategories, minPrice, maxPrice, searchTerm } = useCategories();
  const [products, setProducts] = useState<ExtendedProduct[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const { ref, inView } = useInView({
    rootMargin: '200px',
    threshold: 0,
  });
  const pageRef = useRef(1);
  const user = useCurrentUser();
  //const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);

  const fetchProducts = useCallback(async (page: number, perPage: number, reset: boolean = false, retries = 3) => {
    setLoading(true);
    setError(null);
    console.log(`${LOG_PREFIX} Fetching products page:`, page);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
        categories: selectedCategories.join(','),
        searchTerm
      });

      if (minPrice !== null && minPrice !== undefined) {
        params.append('minPrice', minPrice.toString());
      }

      if (maxPrice !== null && maxPrice !== undefined) {
        params.append('maxPrice', maxPrice.toString());
      }

      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data: ExtendedProduct[] = await response.json();
      console.log(`${LOG_PREFIX} Fetched data:`, data);

      setProducts(prev => reset ? data : [...prev, ...data.filter(product => !prev.find(p => p.id === product.id))]);
      setCategories(prev => Array.from(new Set([...prev, ...data.map(product => product.category)])));

      if (data.length < perPage) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Error fetching products:`, error);
      if (retries > 0) {
        console.log(`${LOG_PREFIX} Retrying... (${retries} attempts left)`);
        setIsRetrying(true);
        setTimeout(() => {
          setIsRetrying(false);
          fetchProducts(page, perPage, reset, retries - 1);
        }, 1000);
        return;
      }
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedCategories, minPrice, maxPrice, searchTerm, setCategories]);

  const debouncedFetchProducts = useCallback(debounce(fetchProducts, 300), [fetchProducts]);

  useEffect(() => {
    console.log(`${LOG_PREFIX} Initial fetch`);
    fetchProducts(1, perPage, true);
    return () => debouncedFetchProducts.cancel();
  }, [fetchProducts, perPage]);

  useEffect(() => {
    if (inView && hasMore && !loading && !isRetrying) {
      console.log(`${LOG_PREFIX} Loader intersecting, fetching more products`);
      const nextPage = pageRef.current + 1;
      pageRef.current = nextPage;
      fetchProducts(nextPage, perPage);
    }
  }, [inView, hasMore, loading, isRetrying, fetchProducts, perPage]);

  useEffect(() => {
    console.log(`${LOG_PREFIX} Filters changed, fetching filtered products`);
    setPage(1);
    pageRef.current = 1;
    setHasMore(true);
    debouncedFetchProducts(1, perPage, true);
    return () => debouncedFetchProducts.cancel();
  }, [selectedCategories, minPrice, maxPrice, searchTerm, debouncedFetchProducts, perPage]);

  const handlePerPageChange = (value: string) => {
    console.log(`${LOG_PREFIX} Changing perPage to:`, value);
    setPerPage(Number(value));
    setPage(1);
    pageRef.current = 1;
    setProducts([]);
    setHasMore(true);
  };

  const gridClasses = useMemo(() => {
    return `sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6`;
  }, [products.length]);

  /* const toggleSidebar = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isSidebarOpen) {
      setTimeout(() => {
        console.log("Toggle sidebar visibility");
        setIsSidebarHidden(!isSidebarHidden);
      }, 50);
    } else {
      setIsSidebarHidden(!isSidebarHidden);
    }
    setIsSidebarOpen(!isSidebarOpen);
  }; */

  const { isSidebarOpen, toggleSidebar } = useSidebar();

  return (
    <div className="w-full h-full space-y-4">
      <div className='flex flex-col justify-center items-center'>
        <h1 className='text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-bl dark:from-slate-300 from-slate-500 dark:to-slate-300 to-slate-900 text-pretty'>Products Page</h1>
      </div>
      <div className="flex justify-between items-center px-4">
        <div className='flex h-10 items-center justify-between rounded-md px-3 py-2 disabled:opacity-50 [&>span]:line-clamp-1 w-[180px]'>
          <button onClick={toggleSidebar} className={`sidebar-toggle-btn-products ${isSidebarOpen ? 'rounded-tr-lg bg-slate-300 dark:bg-slate-950' : 'rounded-r'}`}>
            {isSidebarOpen ? (
              <div className="animate-pulse"><PanelLeftClose className="h-10 w-10" /></div>
            ) : (
              <div className="animate-pulse"><PanelLeftOpen className="h-10 w-10" /></div>
            )}
          </button>
        </div>
        <Select value={perPage.toString()} onValueChange={handlePerPageChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="pages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 per page</SelectItem>
            <SelectItem value="20">20 per page</SelectItem>
            <SelectItem value="30">30 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && !loading && products.length === 0 && <div className="text-red-500">{error}</div>}
      {(loading || isRetrying) && products.length === 0 && <ProductsSkeleton />}
      {products.length > 0 && (
        <div className={`${products.length === 1 && 'flex justify-center'}`}>
          <div className={`grid py-6 px-2 md:px-4 ${products.length === 1 ? 'sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1' : gridClasses} `}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {hasMore && (
            <div ref={ref} className="flex justify-center py-4">
              <Spinner />
            </div>
          )}
        </div>
      )}
    </div>
  );
}