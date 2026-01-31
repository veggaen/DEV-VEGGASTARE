'use client';

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CiStar } from "react-icons/ci";
import Image from "next/image";
import Link from "next/link";
import ProductsSkeleton from '@/components/uicustom/skeletons/products-skeleton';
import type { ProductsListItem } from '@/lib/types/products';
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useCategories } from '@/components/providers/categoriesContext';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { useInView } from 'react-intersection-observer';
import Spinner from '@/components/uicustom/spinner';
import debounce from 'lodash.debounce';
import { useSidebar } from '@/components/providers/product-layoutProvider';

// ★ NEW: network-aware price display
import PriceAmount from "@/components/crypto-related/PriceAmount";

// ★ NEW: Unified products toolbar with categories, search, and filter controls
import { ProductsToolbar } from "@/components/uicustom/products/ProductsToolbar";

type ExtendedProduct = ProductsListItem;

const LOG_PREFIX = 'frontend/app/products/page.tsx';

const DEBUG_PRODUCTS =
	process.env.NODE_ENV !== 'production' &&
	process.env.NEXT_PUBLIC_DEBUG_PRODUCTS === '1';

const ProductCard = React.memo(
	({ product, priority }: { product: ExtendedProduct; priority?: boolean }) => {
		const reduceMotion = useReducedMotion();
		return (
			<div className="group flex flex-col overflow-hidden rounded-lg border border-black/10 dark:border-white/10 bg-white/35 dark:bg-white/[0.02] hover:bg-white/50 dark:hover:bg-white/[0.03] transition-colors">
				<div className="relative">
					<Carousel>
						<CarouselContent>
							{product.image.map((image, idx) => (
								<CarouselItem key={idx}>
									<AspectRatio ratio={1 / 1}>
										<Image
											src={image}
											alt={product.title}
											sizes="100%"
											width={600}
											height={600}
											priority={Boolean(priority && idx === 0)}
											className="object-cover"
										/>
									</AspectRatio>
								</CarouselItem>
							))}
						</CarouselContent>
						<CarouselPrevious className="opacity-0 group-hover:opacity-100 transition-opacity" />
						<CarouselNext className="opacity-0 group-hover:opacity-100 transition-opacity" />
					</Carousel>

					<div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
					<div className="absolute left-3 bottom-3 flex gap-2">
						<motion.span
							initial={reduceMotion ? false : { opacity: 0, y: -14, filter: "blur(8px)" }}
							animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
							transition={
								reduceMotion
									? undefined
									: { type: "spring", stiffness: 620, damping: 24, mass: 0.7 }
							}
							className="rounded-sm bg-black/50 text-white text-[11px] px-1.5 py-0.5"
						>
							{product.category}
						</motion.span>
					</div>
				</div>

				<div className="p-3 md:p-4 flex flex-col gap-2 flex-grow">
					<div className="min-w-0">
						<h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{product.title}</h2>
						<p className="text-sm text-slate-600 dark:text-slate-300 truncate">{product.description}</p>
						<p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
							<span className="opacity-80">Seller:</span>
							{product.company ? (
								<Link href={`/companies/${product.company.id}`} className="group/seller inline-flex items-center" aria-label={`View company ${product.company.name}`}>
									<motion.span
										whileHover={reduceMotion ? undefined : { y: -1, scale: 1.03 }}
										whileTap={reduceMotion ? undefined : { scale: 0.98 }}
										transition={reduceMotion ? undefined : { type: "spring", stiffness: 520, damping: 30, mass: 0.6 }}
										className={
											"relative inline-flex items-center rounded-full px-2 py-0.5 border border-transparent " +
											"text-slate-600 dark:text-slate-300 " +
											"group-hover/seller:border-slate-300/70 dark:group-hover/seller:border-slate-600/60 " +
											"group-hover/seller:bg-gradient-to-r group-hover/seller:from-indigo-500/10 group-hover/seller:via-fuchsia-500/10 group-hover/seller:to-emerald-500/10 " +
											"group-hover/seller:text-slate-900 dark:group-hover/seller:text-slate-100"
										}
									>
										{product.company.name}
									</motion.span>
								</Link>
							) : (
								<span className="text-slate-600 dark:text-slate-300">{product.user?.name ?? "Unknown"}</span>
							)}
						</p>
					</div>

					<div className="mt-auto flex items-center justify-between gap-3">
						<div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
							<CiStar className="h-4 w-4 text-yellow-500" />
						</div>

						<div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
							<PriceAmount usd={product.price} />
						</div>
					</div>

					<Button asChild variant="vegaNormalBtn" className="w-full rounded-md">
						<Link href={`/products/${product.id}`}>View</Link>
					</Button>
				</div>
			</div>
		);
	}
);

ProductCard.displayName = 'ProductCard';

export default function MyProductsPage() {
	const reduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
	const [products, setProducts] = useState<ExtendedProduct[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const { ref, inView } = useInView({
    rootMargin: '200px',
    threshold: 0,
  });
  const pageRef = useRef(1);
	const lastFilterKeyRef = useRef<string>('');
  const { setCategories, selectedCategories, minPrice, maxPrice, searchTerm, selectedSellers } = useCategories();

	const {
		isContentScrolled,
		registerProductsFrame,
		scrollProgress,
		setShowFooter,
		perPage,
		productsControlsVisible,
	} = useSidebar();

	const filterKey = useMemo(
		() =>
			JSON.stringify({
				selectedCategories,
				selectedSellers,
				minPrice,
				maxPrice,
				searchTerm,
				perPage,
			}),
		[selectedCategories, selectedSellers, minPrice, maxPrice, searchTerm, perPage]
	);

	const lastPerPageRef = useRef(perPage);

  const fetchProducts = useCallback(async (page: number, perPage: number, reset: boolean = false, retries = 3) => {
    setLoading(true);
    setError(null);
		if (DEBUG_PRODUCTS) console.log(`${LOG_PREFIX} Fetching products page:`, page);
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

      if (selectedSellers && selectedSellers.length > 0) {
        params.append('sellerIds', selectedSellers.join(','));
      }

      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
	      const data: ExtendedProduct[] = await response.json();
	      // Avoid logging the entire payload; it can be large and slow down dev.

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
  }, [selectedCategories, selectedSellers, minPrice, maxPrice, searchTerm, setCategories]);

  const debouncedFetchProducts = useCallback(debounce(fetchProducts, 300), [fetchProducts]);

  useEffect(() => {
    if (inView && hasMore && !loading && !isRetrying) {
			if (DEBUG_PRODUCTS) console.log(`${LOG_PREFIX} Loader intersecting, fetching more products`);
      const nextPage = pageRef.current + 1;
      pageRef.current = nextPage;
      fetchProducts(nextPage, perPage);
    }
  }, [inView, hasMore, loading, isRetrying, fetchProducts, perPage]);

  useEffect(() => {
		// Avoid duplicate work (including dev StrictMode effect re-runs) by only
		// refetching when the effective filter key changes.
		if (lastFilterKeyRef.current === filterKey) return;
		lastFilterKeyRef.current = filterKey;

		// If the page size changed, clear the list immediately to avoid showing stale
		// paging while the new request is inflight.
		if (lastPerPageRef.current !== perPage) {
			lastPerPageRef.current = perPage;
			setProducts([]);
		}

		if (DEBUG_PRODUCTS) console.log(`${LOG_PREFIX} Filters changed, fetching filtered products`);
    setPage(1);
    pageRef.current = 1;
    setHasMore(true);
		// Use immediate fetch to ensure UI updates quickly; debounce still helps when user
		// types/adjusts multiple controls rapidly.
		debouncedFetchProducts(1, perPage, true);
    return () => debouncedFetchProducts.cancel();
	}, [filterKey, debouncedFetchProducts, perPage]);

  const gridClasses = useMemo(() => {
			// Larger cards / less dense grid.
			return `sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-5`;
  }, []);

	// Hide footer while more products can load, show when all loaded
	useEffect(() => {
		setShowFooter(!hasMore);
	}, [hasMore, setShowFooter]);

	const controlsScrolled = isContentScrolled;
	const toolbarRef = useRef<HTMLDivElement | null>(null);

	const frameClassName = "mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6";

	// Keep a CSS var in sync so the filters sidebar can avoid overlapping the toolbar.
	useLayoutEffect(() => {
		const el = toolbarRef.current;
		if (!el) return;

		const update = () => {
			const h = el.getBoundingClientRect().height;
						document.documentElement.style.setProperty(
							"--products-controls-height",
							`${h}px`
						);
						document.documentElement.style.setProperty(
							"--products-controls-offset",
							controlsScrolled && productsControlsVisible ? `${h}px` : "0px"
						);
					};

					update();
					const ro = new ResizeObserver(update);
					ro.observe(el);
					return () => {
						ro.disconnect();
						// Reset on unmount to avoid leaking into other pages.
						document.documentElement.style.setProperty("--products-controls-offset", "0px");
						document.documentElement.style.setProperty("--products-controls-height", "0px");
					};
				}, [controlsScrolled, productsControlsVisible]);

	  return (
	    <div className="w-full">
					{/* Scroll progress indicator - thin horizontal bar at the very top */}
					<div
						className="fixed top-0 left-0 right-0 h-[2px] z-[80] pointer-events-none"
						aria-hidden="true"
					>
						<div
							className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 origin-left transition-transform duration-75 ease-out"
							style={{ transform: `scaleX(${scrollProgress})` }}
						/>
					</div>

					{/* Centered frame anchor used for sidebar snap points */}
		      <div ref={registerProductsFrame} className={frameClassName}>
						{/*
							This header block creates vertical space before the sticky controls bar.
							Collapse it as soon as the user scrolls even 1px so the controls bar can
							visually “mount” to the TopBar on the first scroll notch.
							Uses CSS grid for smooth height collapse (avoids max-h jitter).
						*/}
						<div
							className="grid transition-[grid-template-rows] duration-200 ease-out"
							style={{ gridTemplateRows: controlsScrolled ? '0fr' : '1fr' }}
						>
							<div className="overflow-hidden">
								<div
									className={`py-6 transform-gpu transition-[opacity,transform] duration-200 ease-out ${
										controlsScrolled ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0"
									}`}
								>
									<div className="flex items-end justify-between gap-4">
										<div className="min-w-0">
									<motion.div
										initial={reduceMotion ? false : { opacity: 0, y: -18, filter: 'blur(10px)' }}
										animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
										transition={reduceMotion ? undefined : { type: 'spring', stiffness: 560, damping: 26, mass: 0.7 }}
										className="inline-flex items-center gap-2"
									>
										<span className="rounded-full border border-black/10 bg-white/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-700 backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
											{selectedCategories.length
												? selectedCategories.length === 1
													? selectedCategories[0]
													: `${selectedCategories.length} categories`
												: 'Marketplace'}
										</span>
									</motion.div>

									<motion.h1
										className="group relative mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white"
										initial={reduceMotion ? false : { opacity: 0, y: 10 }}
										animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
										transition={reduceMotion ? undefined : { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
									>
										<span className="relative">Products</span>
										<span
											aria-hidden
											className="pointer-events-none absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-sky-300 to-fuchsia-300 opacity-0 transition-opacity duration-300 group-hover:opacity-60"
										>
											Products
										</span>
									</motion.h1>

									<motion.p
										className="mt-1 text-sm text-slate-600 dark:text-slate-300"
										initial={reduceMotion ? false : { opacity: 0, y: 8 }}
										animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
										transition={reduceMotion ? undefined : { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
									>
										Discover listings and filter by category, seller, and price.
									</motion.p>
								</div>
							</div>
						</div>
					</div>
				</div>
				</div>

							{/* Unified products toolbar with categories, search, and filter controls */}
							<div className="sticky top-0 z-50" ref={toolbarRef}>
								<ProductsToolbar isScrolled={controlsScrolled} />
							</div>

	      <div className={`${frameClassName} pb-10`}>
	        <div className="mt-6">
          {error && !loading && products.length === 0 && (
            <div className="text-red-500">{error}</div>
          )}
          {(loading || isRetrying) && products.length === 0 && <ProductsSkeleton />}
          {products.length > 0 && (
            <div className={`${products.length === 1 && 'flex justify-center'}`}>
		              <div
		                className={`grid gap-2 md:gap-3 ${
                  products.length === 1
                    ? 'grid-cols-1 max-w-md w-full'
                    : `grid-cols-1 ${gridClasses}`
                }`}
              >
	                {products.map((product, idx) => (
	                  <ProductCard key={product.id} product={product} priority={idx < 8} />
	                ))}
              </div>
              {hasMore && (
                <div ref={ref} className="flex justify-center py-8">
                  <Spinner />
                </div>
              )}
            </div>
          )}
	        </div>
	      </div>
    </div>
  );
}
