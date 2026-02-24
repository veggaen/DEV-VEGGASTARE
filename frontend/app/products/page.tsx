'use client';

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MdAdd } from "react-icons/md";
import { FiShoppingCart, FiCheck, FiZap, FiPackage, FiLayers } from "react-icons/fi";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/cart-context";
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
import { useUiPreferences } from '@/components/providers/ui-preferences';
import { useCurrentUser } from '@/hooks/use-current-user';

// ★ NEW: network-aware price display
import PriceAmount from "@/components/crypto-related/PriceAmount";

// ★ NEW: Unified products toolbar with categories, search, and filter controls
import { ProductsToolbar } from "@/components/uicustom/products/ProductsToolbar";

type ExtendedProduct = ProductsListItem;

const LOG_PREFIX = 'frontend/app/products/page.tsx';

const DEBUG_PRODUCTS =
	process.env.NODE_ENV !== 'production' &&
	process.env.NEXT_PUBLIC_DEBUG_PRODUCTS === '1';

const PRODUCT_TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
	DIGITAL: { label: "Digital", icon: FiZap, color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
	PHYSICAL: { label: "Physical", icon: FiPackage, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
	HYBRID: { label: "Hybrid", icon: FiLayers, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
};

const ProductCard = React.memo(
	({ product, priority }: { product: ExtendedProduct; priority?: boolean }) => {
		const reduceMotion = useReducedMotion();
		const { prefs } = useUiPreferences();
		const showFancyHover = prefs.hoverEffects === "colorful";
		const router = useRouter();
		const { addItem } = useCart();
		const [adding, setAdding] = useState(false);
		const [added, setAdded] = useState(false);

		const handleAddToCart = useCallback(async (e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setAdding(true);
			const ok = await addItem(product.id);
			setAdding(false);
			if (ok) {
				setAdded(true);
				setTimeout(() => setAdded(false), 2000);
			}
		}, [addItem, product.id]);

		const handleBuyNow = useCallback(async (e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			const ok = await addItem(product.id);
			if (ok) {
				router.push("/checkout");
			}
		}, [addItem, product.id, router]);

		const typeMeta = PRODUCT_TYPE_META[(product as any).productType ?? "PHYSICAL"] ?? PRODUCT_TYPE_META.PHYSICAL;
		const TypeIcon = typeMeta.icon;
		const outOfStock = product.stock === 0;

		return (
			<div className={`group flex flex-col overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-900/70 shadow-sm ${outOfStock ? "opacity-60 pointer-events-none" : "hover:-translate-y-1 hover:shadow-lg hover:shadow-black/[0.08] dark:hover:shadow-black/30"} transition-all duration-300`}>
				{/* ── Image / Carousel ── */}
				<Link href={`/products/${product.id}`} className="relative overflow-hidden">
					<Carousel>
						<CarouselContent>
							{product.image.map((image, idx) => (
								<CarouselItem key={idx}>
									<AspectRatio ratio={4 / 5}>
										<Image
											src={image}
											alt={product.title}
											fill
											sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
											priority={Boolean(priority && idx === 0)}
											className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
										/>
									</AspectRatio>
								</CarouselItem>
							))}
						</CarouselContent>
						<CarouselPrevious className="left-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" />
						<CarouselNext className="right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" />
					</Carousel>

					{/* Gradient overlay */}
					<div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />

					{/* Badges row — category + product type */}
					<div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1.5">
						<span className="inline-flex items-center rounded-md bg-black/55 backdrop-blur-sm text-white text-[10px] font-medium tracking-wide px-1.5 py-0.5">
							{product.category}
						</span>
						<span className={`inline-flex items-center gap-0.5 rounded-md border backdrop-blur-sm text-[10px] font-medium px-1.5 py-0.5 ${typeMeta.color}`}>
							<TypeIcon className="h-2.5 w-2.5" />
							{typeMeta.label}
						</span>
					</div>

					{/* Out of stock overlay */}
					{outOfStock && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
							<span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-zinc-800">Out of stock</span>
						</div>
					)}
				</Link>

				{/* ── Card body ── */}
				<div className="flex flex-col gap-1.5 p-3 pb-2 grow">
					{/* Title — linked */}
					<Link href={`/products/${product.id}`} className="group/title">
						<h2 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug group-hover/title:text-sky-600 dark:group-hover/title:text-sky-400 transition-colors">
							{product.title}
						</h2>
					</Link>

					{/* Description */}
					<p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
						{product.description}
					</p>

					{/* Seller + stock row */}
					<div className="flex items-center justify-between gap-2 mt-0.5">
						<p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate min-w-0">
							<span className="mr-1">by</span>
							{product.company ? (
								<Link
									href={`/companies/${product.company.id}`}
									className={`font-medium transition-colors ${showFancyHover ? "hover:text-fuchsia-500 dark:hover:text-fuchsia-400" : "hover:text-zinc-700 dark:hover:text-zinc-200"}`}
								>
									{product.company.name}
								</Link>
							) : product.user ? (
								<Link
									href={`/profile/${product.user.id}`}
									className={`font-medium transition-colors ${showFancyHover ? "hover:text-sky-500 dark:hover:text-sky-400" : "hover:text-zinc-700 dark:hover:text-zinc-200"}`}
								>
									{product.user.name}
								</Link>
							) : (
								<span>Unknown</span>
							)}
						</p>
						{product.stock > 0 && product.stock <= 5 && (
							<span className="shrink-0 text-[10px] font-medium text-amber-500 dark:text-amber-400">
								Only {product.stock} left
							</span>
						)}
					</div>
				</div>

				{/* ── Price + Actions footer ── */}
				<div className="border-t border-black/[0.05] dark:border-white/[0.05] px-3 py-2.5 mt-auto">
					{/* Price */}
					<div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">
						<PriceAmount
							amount={product.price}
							currency={product.priceCurrency || 'USD'}
							acceptsWeb3={Array.isArray(product.acceptedTokens) && product.acceptedTokens.length > 0}
							acceptedCryptos={product.acceptedTokens?.map((tok) => tok.symbol)}
						/>
					</div>

					{/* Action buttons — full-width row */}
					<div className="flex items-center gap-1.5">
						<Button
							type="button"
							variant="default"
							className="flex-1 h-8 rounded-lg text-xs font-semibold"
							onClick={handleBuyNow}
							disabled={outOfStock}
						>
							Buy Now
						</Button>
						<Button
							type="button"
							variant="outline"
							size="icon"
							className="h-8 w-8 rounded-lg border-zinc-200 dark:border-zinc-700 shrink-0"
							title="Add to cart"
							onClick={handleAddToCart}
							disabled={adding || outOfStock}
						>
							{adding ? (
								<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
							) : added ? (
								<FiCheck className="h-3.5 w-3.5 text-emerald-500" />
							) : (
								<FiShoppingCart className="h-3.5 w-3.5" />
							)}
						</Button>
					</div>
				</div>
			</div>
		);
	}
);

ProductCard.displayName = 'ProductCard';

export default function MyProductsPage() {
	const reduceMotion = useReducedMotion();
	const { prefs } = useUiPreferences();
	const showFancyHover = prefs.hoverEffects === "colorful";
	const user = useCurrentUser();
	const isLoggedIn = !!user;
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
	    <div className="w-full min-h-full">
					{/* Scroll progress indicator - thin horizontal bar at the very top */}
					<div
						className="fixed top-0 left-0 right-0 h-[2px] z-80 pointer-events-none"
						aria-hidden="true"
					>
						<div
							className="h-full bg-linear-to-r from-sky-400 to-indigo-500 origin-left transition-transform duration-75 ease-out"
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
											initial={reduceMotion ? false : { opacity: 0, y: -18 }}
											animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
										transition={reduceMotion ? undefined : { type: 'spring', stiffness: 560, damping: 26, mass: 0.7 }}
										className="inline-flex items-center gap-2"
									>
										<span className="rounded-full border border-black/10 bg-white/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-700 backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200">
											{selectedCategories.length
												? selectedCategories.length === 1
													? selectedCategories[0]
													: `${selectedCategories.length} categories`
												: 'Marketplace'}
										</span>
									</motion.div>

									<motion.h1
										className="group relative mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white"
										initial={reduceMotion ? false : { opacity: 0, y: 10 }}
										animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
										transition={reduceMotion ? undefined : { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
									>
										<span className="relative">Products</span>
										{showFancyHover && (
											<span
												aria-hidden
												className="pointer-events-none absolute inset-0 text-transparent bg-clip-text bg-linear-to-r from-emerald-300 via-sky-300 to-fuchsia-300 opacity-0 transition-opacity duration-300 group-hover:opacity-60"
											>
												Products
											</span>
										)}
									</motion.h1>

									<motion.p
										className="mt-1 text-sm text-zinc-600 dark:text-zinc-300"
										initial={reduceMotion ? false : { opacity: 0, y: 8 }}
										animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
										transition={reduceMotion ? undefined : { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
									>
										Discover listings and filter by category, seller, and price.
									</motion.p>
									</div>

									<div className="shrink-0 pb-0.5">
										{isLoggedIn ? (
											<Link
												href="/products/create"
												aria-label="Create a new product listing"
												className="group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
										>
											<MdAdd className="h-4 w-4 opacity-80 group-hover:opacity-100" />
											<span>Create listing</span>
										</Link>
									) : (
											<Link
												href={`/auth/login?callbackUrl=${encodeURIComponent('/products/create')}`}
												aria-label="Sign in to create a listing"
												className="group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
										>
											<MdAdd className="h-4 w-4 opacity-80 group-hover:opacity-100" />
											<span>Sell</span>
										</Link>
									)}
									</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Sticky toolbar - sticks at top of scroll container (visually below topbar) */}
			<div 
				ref={toolbarRef}
				className="sticky top-0 z-50"
			>
				<ProductsToolbar isScrolled={controlsScrolled} />
			</div>

			<div className={`${frameClassName} pb-10 min-h-[calc(100vh-var(--app-header-offset))]`}>
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
