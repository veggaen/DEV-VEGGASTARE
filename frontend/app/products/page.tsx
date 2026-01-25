'use client';

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import {
	LuPanelLeftClose,
	LuPanelLeftOpen,
	LuPanelRightClose,
	LuPanelRightOpen,
} from "react-icons/lu";
import { CiStar } from "react-icons/ci";
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
import { useSidebar, type SidebarDock } from '@/components/providers/product-layoutProvider';
import { MdAdd } from 'react-icons/md';

// ★ NEW: network-aware price display
import PriceAmount from "@/components/crypto-related/PriceAmount";

interface ExtendedProduct extends Product {
  user?: Pick<User, 'id' | 'name'>;
  company?: Pick<Company, 'id' | 'name'> | null;
}

const LOG_PREFIX = 'frontend/app/products/page.tsx';

	const ProductCard = React.memo(
	  ({ product, priority }: { product: ExtendedProduct; priority?: boolean }) => (
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
	        <span className="rounded-sm bg-black/50 text-white text-[11px] px-1.5 py-0.5">{product.category}</span>
      </div>
    </div>

	    <div className="p-3 md:p-4 flex flex-col gap-2 flex-grow">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{product.title}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{product.description}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
          Seller: {product.company ? product.company.name : product.user?.name}
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
  )
);

ProductCard.displayName = 'ProductCard';

export default function MyProductsPage() {
  const [loading, setLoading] = useState(true);
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
  const { setCategories, selectedCategories, minPrice, maxPrice, searchTerm, setSearchTerm, selectedSellers } = useCategories();

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
  }, [selectedCategories, selectedSellers, minPrice, maxPrice, searchTerm, debouncedFetchProducts, perPage]);

  const handlePerPageChange = (value: string) => {
    console.log(`${LOG_PREFIX} Changing perPage to:`, value);
    setPerPage(Number(value));
    setPage(1);
    pageRef.current = 1;
    setProducts([]);
    setHasMore(true);
  };

  const gridClasses = useMemo(() => {
			// Larger cards / less dense grid.
			return `sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-5`;
  }, []);

	const {
		isSidebarOpen,
		toggleSidebar,
		isContentScrolled,
			sidebarDock,
			setSidebarDock,
			registerProductsFrame,
			scrollProgress,
	} = useSidebar();

	const controlsScrolled = isContentScrolled;
		const controlsBarRef = useRef<HTMLDivElement | null>(null);
		const isRight = sidebarDock === 'edge-right' || sidebarDock === 'frame-right';
		const isEdgeDock = sidebarDock === 'edge-left' || sidebarDock === 'edge-right';
	const SidebarIcon = isSidebarOpen
		? isRight
			? LuPanelRightClose
			: LuPanelLeftClose
		: isRight
			? LuPanelRightOpen
			: LuPanelLeftOpen;

					const frameClassName = "mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6";
					// Keep the *content* width stable (like the main TopBar) while letting the sticky bar's
					// background/border go full-width. This prevents the search input from becoming huge and
					// avoids left/right controls shifting positions during the scroll morph.
					const controlsContainerClassName = frameClassName;

				// Keep a CSS var in sync so the filters sidebar can avoid overlapping this sticky bar.
				// useLayoutEffect prevents a 1-frame lag that can cause brief overlap during the morph.
				useLayoutEffect(() => {
					const el = controlsBarRef.current;
					if (!el) return;

					const update = () => {
						const h = el.getBoundingClientRect().height;
						document.documentElement.style.setProperty(
							"--products-controls-height",
							`${h}px`
						);
						document.documentElement.style.setProperty(
							"--products-controls-offset",
							controlsScrolled ? `${h}px` : "0px"
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
				}, [controlsScrolled]);

	  return (
	    <div className="w-full">
					{/* Scroll progress indicator - thin horizontal bar at the very top */}
					<div
						className="fixed top-[var(--app-header)] left-0 right-0 h-[2px] z-50 pointer-events-none"
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
						*/}
						<div
							className={`overflow-hidden ${
								controlsScrolled ? "max-h-0 py-0 opacity-0" : "max-h-40 py-6 opacity-100"
							}`}
						>
							<div className="flex items-end justify-between gap-4">
								<div className="min-w-0">
									<h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
										Products
									</h1>
									<p className="text-sm text-slate-600 dark:text-slate-300">
										Discover listings and filter by category, seller, and price.
									</p>
								</div>
							</div>
						</div>
				</div>

							{/* Full-width sticky controls bar */}
							<nav className="sticky top-0 z-40 pointer-events-none">
								<div
									ref={controlsBarRef}
									className={
										`pointer-events-auto relative transition-[box-shadow,border-color] ease-out ${
											controlsScrolled
												? "duration-200 border-b border-black/10 dark:border-white/10 shadow-sm"
												: "duration-150 border-b border-transparent shadow-none"
										}`
									}
								>
									{/* Glass fill */}
									<div
										aria-hidden="true"
										style={{ willChange: "opacity" }}
										className={
											`pointer-events-none absolute inset-0 bg-gradient-to-b from-white/85 to-white/55 dark:from-slate-950/65 dark:to-slate-950/35 backdrop-blur-xl transform-gpu transition-opacity ${
												controlsScrolled
													? "opacity-100 duration-200 ease-out"
													: "opacity-0 duration-100 ease-in"
											}`
										}
									/>

									<div className={`${controlsContainerClassName} relative py-3`}>
										<div className="flex flex-wrap items-center gap-3 lg:grid lg:grid-cols-[auto,minmax(0,1fr),auto] lg:items-center lg:gap-4">
											{/* Filters controls - left when sidebar is left, right when sidebar is right */}
											{/* When right-docked, reverse order so Filters button is at the far right edge */}
											<div className={`flex items-center gap-3 lg:row-start-1 ${isRight ? "lg:col-start-3 lg:justify-self-end flex-row-reverse" : "lg:col-start-1"}`}>
												<Button
													variant="outline"
													onClick={toggleSidebar}
															className="h-11 rounded-lg border-transparent bg-white/45 text-slate-700 shadow-sm shadow-black/[0.03] hover:bg-white/70 hover:text-slate-950 hover:border-black/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.10] dark:hover:text-slate-50 dark:hover:border-white/15 focus-visible:ring-2 focus-visible:ring-sky-400/35 focus-visible:ring-offset-0"
													aria-label={isSidebarOpen ? "Close filters" : "Open filters"}
												>
													<SidebarIcon className="h-5 w-5" />
													<span className="ml-2 hidden sm:inline">Filters</span>
												</Button>

														<Select value={sidebarDock} onValueChange={(v) => setSidebarDock(v as SidebarDock)}>
															<SelectTrigger className="hidden sm:flex w-[210px] h-11 rounded-lg border-transparent bg-white/45 text-slate-700 shadow-sm shadow-black/[0.03] hover:bg-white/70 hover:border-black/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.10] dark:hover:border-white/15 focus-visible:ring-2 focus-visible:ring-sky-400/35 focus-visible:ring-offset-0">
														<SelectValue placeholder="Filters position" />
													</SelectTrigger>
															<SelectContent className="rounded-lg border-black/10 bg-white/95 text-slate-950 shadow-xl shadow-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-50">
														<SelectItem value="edge-left">Edge left</SelectItem>
														<SelectItem value="frame-left">Left of products</SelectItem>
														<SelectItem value="frame-right">Right of products</SelectItem>
														<SelectItem value="edge-right">Edge right</SelectItem>
													</SelectContent>
												</Select>
											</div>

											{/* Center search */}
											<div className="w-full sm:flex-1 lg:row-start-1 lg:col-start-2 lg:w-full lg:justify-self-center lg:max-w-[760px] xl:max-w-[900px]">
													<input
														type="text"
													placeholder="Search products…"
													value={searchTerm}
													onChange={(e) => setSearchTerm(e.target.value)}
														className="w-full h-11 rounded-lg border border-transparent bg-white/45 px-3 py-2 text-[13px] text-slate-800 shadow-sm shadow-black/[0.03] placeholder:text-slate-500 outline-none hover:bg-white/70 hover:border-black/10 dark:bg-white/[0.06] dark:text-slate-100 dark:placeholder:text-slate-400 dark:hover:bg-white/[0.10] dark:hover:border-white/15 focus-visible:ring-2 focus-visible:ring-sky-400/35 focus-visible:ring-offset-0"
												/>
											</div>

											{/* New listing + pagination - right when sidebar is left, left when sidebar is right */}
											<div className={`flex items-center gap-2 lg:row-start-1 ${isRight ? "lg:col-start-1 lg:justify-self-start" : "lg:col-start-3 lg:justify-self-end"}`}>
												<Button
													asChild
													variant="outline"
														className="h-11 rounded-lg border-transparent bg-white/45 text-slate-700 shadow-sm shadow-black/[0.03] hover:bg-white/70 hover:text-slate-950 hover:border-black/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.10] dark:hover:text-slate-50 dark:hover:border-white/15 focus-visible:ring-2 focus-visible:ring-sky-400/35 focus-visible:ring-offset-0"
												>
													<Link href="/products/create" className="flex items-center gap-2" aria-label="Create a new product listing">
														<MdAdd className="h-5 w-5" />
														<span className="hidden sm:inline">New listing</span>
													</Link>
												</Button>

												<div className="hidden sm:flex items-center">
													<Select value={perPage.toString()} onValueChange={handlePerPageChange}>
															<SelectTrigger className="w-[130px] h-11 rounded-lg border-transparent bg-white/45 text-slate-700 shadow-sm shadow-black/[0.03] hover:bg-white/70 hover:border-black/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.10] dark:hover:border-white/15 focus-visible:ring-2 focus-visible:ring-sky-400/35 focus-visible:ring-offset-0" title="Items per page">
															<span className="tabular-nums">{perPage}</span>
															<span className="sr-only">
																<SelectValue aria-label="Items per page" />
															</span>
														</SelectTrigger>
															<SelectContent className="rounded-lg border-black/10 bg-white/95 text-slate-950 shadow-xl shadow-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-50">
															<SelectItem value="10" className="whitespace-nowrap">10 per page</SelectItem>
															<SelectItem value="20" className="whitespace-nowrap">20 per page</SelectItem>
															<SelectItem value="30" className="whitespace-nowrap">30 per page</SelectItem>
															<SelectItem value="50" className="whitespace-nowrap">50 per page</SelectItem>
														</SelectContent>
													</Select>
												</div>

												{/* Compact per-page select for small screens */}
												<div className="sm:hidden">
													<Select value={perPage.toString()} onValueChange={handlePerPageChange}>
															<SelectTrigger className="w-[120px] h-11 rounded-lg border-transparent bg-white/45 text-slate-700 shadow-sm shadow-black/[0.03] hover:bg-white/70 hover:border-black/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.10] dark:hover:border-white/15 focus-visible:ring-2 focus-visible:ring-sky-400/35 focus-visible:ring-offset-0" title="Items per page">
															<span className="tabular-nums">{perPage}</span>
															<span className="sr-only">
																<SelectValue aria-label="Items per page" />
															</span>
														</SelectTrigger>
															<SelectContent className="rounded-lg border-black/10 bg-white/95 text-slate-950 shadow-xl shadow-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-50">
															<SelectItem value="10" className="whitespace-nowrap">10 per page</SelectItem>
															<SelectItem value="20" className="whitespace-nowrap">20 per page</SelectItem>
															<SelectItem value="30" className="whitespace-nowrap">30 per page</SelectItem>
															<SelectItem value="50" className="whitespace-nowrap">50 per page</SelectItem>
														</SelectContent>
													</Select>
												</div>
											</div>
									</div>
								</div>
							</div>
					</nav>

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
