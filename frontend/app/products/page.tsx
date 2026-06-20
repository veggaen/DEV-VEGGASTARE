'use client';

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MdAdd } from "react-icons/md";
import { FiShoppingCart, FiCheck, FiZap, FiPackage, FiLayers } from "react-icons/fi";
import { CreditCard, Eye, ShoppingBag, Sparkles, Truck, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/cart-context";
import Image from "next/image";
import Link from "next/link";
import ProductsSkeleton from '@/components/uicustom/skeletons/products-skeleton';
import type { ProductsListItem } from '@/lib/types/products';
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useCategories } from '@/components/providers/categoriesContext';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useInView } from 'react-intersection-observer';
import Spinner from '@/components/uicustom/spinner';
import debounce from 'lodash.debounce';
import { useSidebar } from '@/components/providers/product-layoutProvider';
import { useUiPreferences } from '@/components/providers/ui-preferences';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import HeroParticleField from "@/components/uicustom/home/HeroParticleField";
import { toast } from 'sonner';

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

const productCardMotion = {
	rest: { y: 0 },
	hover: { y: -4 },
};

const productImageMotion = {
	rest: { scale: 1 },
	hover: { scale: 1.045 },
};

const productMediaShadeMotion = {
	rest: { opacity: 0.24 },
	hover: { opacity: 1 },
};

const productMediaMetaMotion = {
	rest: { opacity: 0, y: 12, filter: "blur(5px)" },
	hover: { opacity: 1, y: 0, filter: "blur(0px)" },
};

function getTokenSymbols(product: ExtendedProduct) {
	return Array.from(
		new Set((product.acceptedTokens ?? []).map((token) => token.symbol).filter(Boolean))
	);
}

const ProductCard = React.memo(
	({
		product,
		priority,
		eagerImageSources,
		authStatus,
	}: {
		product: ExtendedProduct;
		priority?: boolean;
		eagerImageSources?: ReadonlySet<string>;
		authStatus: 'loading' | 'authenticated' | 'unauthenticated';
	}) => {
		const { prefs } = useUiPreferences();
		const showFancyHover = prefs.hoverEffects === "colorful";
		const reduceMotion = useReducedMotion();
		const router = useRouter();
		const { addItem } = useCart();
		const [adding, setAdding] = useState(false);
		const [buying, setBuying] = useState(false);
		const [added, setAdded] = useState(false);
		const outOfStock = product.stock === 0;

		const redirectToLogin = useCallback((callbackUrl: string) => {
			router.push(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
		}, [router]);

		const handleAddToCart = useCallback(async (e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (outOfStock) {
				toast.error("This product is currently out of stock.");
				return;
			}
			if (authStatus === 'loading') {
				toast.info('Checking your session...');
				return;
			}
			if (authStatus !== 'authenticated') {
				toast.error('Sign in to add items to your basket', {
					action: {
						label: 'Sign in',
						onClick: () => redirectToLogin(`/products/${product.id}`),
					},
				});
				return;
			}
			setAdding(true);
			const ok = await addItem(product.id);
			setAdding(false);
			if (ok) {
				setAdded(true);
				toast.success('Added to basket', {
					action: { label: 'View basket', onClick: () => router.push('/cart') },
				});
				setTimeout(() => setAdded(false), 2000);
			} else {
				toast.error('Could not add this product to your basket.');
			}
		}, [addItem, authStatus, outOfStock, product.id, redirectToLogin, router]);

		const handleBuyNow = useCallback(async (e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (outOfStock) {
				toast.error("This product is currently out of stock.");
				return;
			}
			if (authStatus === 'loading') {
				toast.info('Checking your session...');
				return;
			}
			if (authStatus !== 'authenticated') {
				toast.error('Sign in to buy this product', {
					action: {
						label: 'Sign in',
						onClick: () => redirectToLogin(`/products/${product.id}`),
					},
				});
				return;
			}
			setBuying(true);
			const ok = await addItem(product.id);
			setBuying(false);
			if (ok) {
				router.push("/checkout");
			} else {
				toast.error('Could not prepare checkout for this product.');
			}
		}, [addItem, authStatus, outOfStock, product.id, redirectToLogin, router]);

		const typeMeta = PRODUCT_TYPE_META[(product as any).productType ?? "PHYSICAL"] ?? PRODUCT_TYPE_META.PHYSICAL;
		const TypeIcon = typeMeta.icon;
		const tokenSymbols = useMemo(() => getTokenSymbols(product), [product]);
		const hasCrypto = tokenSymbols.length > 0;
		const sellerName = product.company?.name ?? product.user?.name ?? "Independent seller";
		const sellerHref = product.company ? `/companies/${product.company.id}` : product.user ? `/profile/${product.user.id}` : null;

		return (
			<motion.article
				layout
				initial="rest"
				animate="rest"
				whileHover={outOfStock ? "rest" : "hover"}
				variants={productCardMotion}
				transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.8 }}
				className={`group relative flex min-h-full flex-col overflow-hidden rounded-lg border border-black/10 bg-white/82 shadow-sm backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-black/42 ${outOfStock ? "opacity-70" : "hover:border-zinc-950/20 hover:shadow-2xl hover:shadow-sky-500/10 dark:hover:border-emerald-300/25 dark:hover:shadow-emerald-500/10"}`}
			>
				<div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-sky-400/40 to-transparent dark:via-emerald-300/30" />
				{/* ── Image / Carousel ── */}
				<div
					className="relative cursor-pointer overflow-hidden"
					role="link"
					tabIndex={0}
					aria-label={`View ${product.title}`}
					onClick={() => router.push(`/products/${product.id}`)}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							router.push(`/products/${product.id}`);
						}
					}}
				>
					<Carousel className="relative z-0">
						<CarouselContent>
							{product.image.map((image, idx) => (
								<CarouselItem key={idx}>
									<AspectRatio ratio={4 / 5}>
										<motion.div
											className="absolute inset-0 will-change-transform"
											variants={reduceMotion ? undefined : productImageMotion}
											transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
										>
											<Image
												src={image}
												alt={product.title}
												fill
												sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
												loading={priority || eagerImageSources?.has(image) ? "eager" : "lazy"}
												preload={priority}
												className="object-cover"
											/>
										</motion.div>
									</AspectRatio>
								</CarouselItem>
							))}
						</CarouselContent>
						{product.image.length > 1 && (
							<>
								<CarouselPrevious className="left-2 z-[60] h-8 w-8 rounded-lg border-white/20 bg-black/35 opacity-0 backdrop-blur-md transition-opacity hover:bg-black/50 group-hover:opacity-100" />
								<CarouselNext className="right-2 z-[60] h-8 w-8 rounded-lg border-white/20 bg-black/35 opacity-0 backdrop-blur-md transition-opacity hover:bg-black/50 group-hover:opacity-100" />
							</>
						)}
					</Carousel>

					<motion.div
						className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-36 bg-linear-to-t from-black/88 via-black/35 to-transparent"
						variants={reduceMotion ? undefined : productMediaShadeMotion}
						transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
					/>
					<motion.div
						className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3 text-white"
						variants={reduceMotion ? undefined : productMediaMetaMotion}
						transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
					>
						<div className="flex items-end justify-between gap-3">
							<div className="min-w-0">
								<div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
									<span className="truncate">{product.category}</span>
									<span className="text-white/35">/</span>
									<span className="inline-flex items-center gap-1">
										<TypeIcon className="h-3 w-3" />
										{typeMeta.label}
									</span>
								</div>
								<div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-white/82">
									<Truck className="h-3 w-3 shrink-0" />
									<span className="truncate">{product.shipFromPostalId || "Ready to ship"}</span>
								</div>
							</div>
							<div className={`shrink-0 text-right text-[11px] font-semibold ${outOfStock ? "text-amber-200" : "text-emerald-200"}`}>
								{outOfStock ? "Out of stock" : `${product.stock} left`}
							</div>
						</div>
					</motion.div>
				</div>

				{/* ── Card body ── */}
				<div className="flex grow flex-col gap-3 p-3">
					<div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
						{sellerHref ? (
							<Link
								href={sellerHref}
								className={`min-w-0 truncate font-medium transition-colors ${showFancyHover ? "hover:text-fuchsia-500 dark:hover:text-fuchsia-300" : "hover:text-zinc-900 dark:hover:text-zinc-100"}`}
							>
								{sellerName}
							</Link>
						) : (
							<span className="min-w-0 truncate font-medium">{sellerName}</span>
						)}
						<Link
							href={`/products/${product.id}`}
							aria-label={`Open ${product.title}`}
							className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
						>
							<Eye className="h-3.5 w-3.5" />
						</Link>
					</div>
					{/* Title — linked */}
					<Link href={`/products/${product.id}`} className="group/title">
						<h2 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-950 transition-colors group-hover/title:text-sky-700 dark:text-zinc-50 dark:group-hover/title:text-emerald-300">
							{product.title}
						</h2>
					</Link>

					{/* Description */}
					<p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
						{product.description}
					</p>

					<div className="flex min-w-0 items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
						<CreditCard className="h-3 w-3 shrink-0" />
						<span>PayPal</span>
						<span className="text-zinc-300 dark:text-zinc-700">/</span>
						<WalletCards className="h-3 w-3 shrink-0" />
						<span className="truncate">{hasCrypto ? tokenSymbols.slice(0, 2).join(", ") : "fiat"}</span>
						{product.stock > 0 && product.stock <= 5 && (
							<span className="ml-auto shrink-0 font-medium text-amber-600 dark:text-amber-300">
								Only {product.stock} left
							</span>
						)}
					</div>
				</div>

				{/* ── Price + Actions footer ── */}
				<div className="mt-auto border-t border-black/[0.06] px-3 py-3 dark:border-white/[0.08]">
					{/* Price */}
					<div className="mb-2 text-sm font-bold text-zinc-950 dark:text-zinc-50">
						<PriceAmount
							amount={product.price}
							currency={product.priceCurrency || 'USD'}
							acceptsWeb3={Array.isArray(product.acceptedTokens) && product.acceptedTokens.length > 0}
							acceptedCryptos={product.acceptedTokens?.map((tok) => tok.symbol)}
							showOriginalAmount={false}
						/>
					</div>

					{/* Action buttons — full-width row */}
					<div className="flex items-center gap-1.5">
						<motion.button
							type="button"
							whileTap={{ scale: 0.96 }}
							className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-950 px-3 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
							onClick={handleBuyNow}
							disabled={buying || outOfStock}
						>
							<ShoppingBag className="h-3.5 w-3.5" />
							{buying ? "Preparing" : "Buy"}
						</motion.button>
						<motion.button
							type="button"
							whileTap={{ scale: 0.94 }}
							className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white/75 text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
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
						</motion.button>
					</div>
				</div>
			</motion.article>
		);
	}
);

ProductCard.displayName = 'ProductCard';

export default function MyProductsPage() {
	const reduceMotion = useReducedMotion();
	const { user, status: authStatus } = useCurrentUserWithStatus();
	const isLoggedIn = authStatus === 'authenticated' && !!user;
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

	const eagerImageSources = useMemo(
		() => new Set(products.slice(0, 8).flatMap((product) => product.image)),
		[products]
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

  const debouncedFetchProducts = useMemo(() => debounce(fetchProducts, 300), [fetchProducts]);

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

	const frameClassName = "relative z-10 mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6";

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
	    <div className="relative isolate min-h-full w-full overflow-hidden bg-white text-zinc-950 dark:bg-black dark:text-white">
					<HeroParticleField fixed density={0.72} centerFade={0.32} className="z-0 opacity-60 dark:opacity-75" />
					<div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-linear-to-b from-sky-50/90 via-white/75 to-white dark:from-emerald-950/20 dark:via-black/80 dark:to-black" />
					<div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(14,165,233,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.04)_1px,transparent_1px)] bg-[size:46px_46px] opacity-80 dark:bg-[linear-gradient(rgba(52,211,153,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.045)_1px,transparent_1px)] dark:opacity-35" />
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
										initial={reduceMotion ? false : { opacity: 0, y: -14 }}
										animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
										transition={reduceMotion ? undefined : { type: 'spring', stiffness: 560, damping: 26, mass: 0.7 }}
										className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400"
									>
										{selectedCategories.length
											? selectedCategories.length === 1
												? selectedCategories[0]
												: `${selectedCategories.length} categories`
											: 'Freedom Store'} / live marketplace
									</motion.div>

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

			<div className={`${frameClassName} min-h-[calc(100vh-var(--app-header-offset))] pb-10`}>
				<div className="mt-6">
					{error && !loading && products.length === 0 && (
						<div className="rounded-lg border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-700 backdrop-blur dark:text-red-200">
							{error}
						</div>
					)}
					{(loading || isRetrying) && products.length === 0 && <ProductsSkeleton />}
					{!loading && !isRetrying && !error && products.length === 0 && (
						<div className="flex min-h-[320px] items-center justify-center rounded-lg border border-black/10 bg-white/70 p-8 text-center backdrop-blur-xl dark:border-white/10 dark:bg-black/40">
							<div className="max-w-md">
								<div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-sky-500/20 bg-sky-500/10 text-sky-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200">
									<Sparkles className="h-5 w-5" />
								</div>
								<h2 className="text-lg font-semibold text-zinc-950 dark:text-white">No products match this view</h2>
								<p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
									Clear a filter, broaden the price range, or create the first listing for this corner of the shop.
								</p>
							</div>
						</div>
					)}
					{products.length > 0 && (
						<div className={`${products.length === 1 && 'flex justify-center'}`}>
							<div
								className={`grid gap-3 md:gap-4 ${
									products.length === 1
										? 'grid-cols-1 max-w-md w-full'
										: `grid-cols-1 ${gridClasses}`
								}`}
							>
								{products.map((product, idx) => (
									<ProductCard
										key={product.id}
										product={product}
										priority={idx < 8}
										eagerImageSources={eagerImageSources}
										authStatus={authStatus}
									/>
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
