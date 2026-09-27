/**
 * @fileOverview Responsive marketplace; its route group scopes loading to the catalog only.
 *               Layout: sticky glass toolbar, a filter column that lives INSIDE the
 *               frame on xl+ (the grid simply has fewer columns beside it — nothing
 *               shifts) and a left Sheet below xl. Cards are glass, with the seller,
 *               a two-line title, price in fiat + crypto, and one accent action.
 * @stability stable
 */
'use client';

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Check, Layers, Package, ShoppingBag, ShoppingCart, Sparkles, X, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { useCart } from '@/contexts/cart-context';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { useProductListing } from '@/hooks/use-product-listing';
import { useCategories } from '@/components/providers/categoriesContext';
import { useSidebar } from '@/components/providers/product-layoutProvider';
import type { ProductsListItem } from '@/lib/types/products';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import ProductsSkeleton from '@/components/uicustom/skeletons/products-skeleton';
import { ProductsToolbar } from '@/components/uicustom/products/ProductsToolbar';
import { CatalogFilters } from '@/components/uicustom/products/CatalogFilters';
import { CatalogHeader, catalogFrame, catalogGrid } from '@/components/uicustom/products/CatalogHeader';
import PriceAmount from '@/components/crypto-related/PriceAmount';
import { productPurchaseState } from '@/lib/product-purchase-state';
import type { CatalogSnapshot } from '@/lib/catalog-snapshot';
import { cn } from '@/lib/utils';

const typeMeta = {
  DIGITAL: { label: 'Digital', icon: Zap },
  PHYSICAL: { label: 'Physical', icon: Package },
  HYBRID: { label: 'Hybrid', icon: Layers },
};

/** `(min-width)` as a subscription; false on the server so the Sheet never renders during SSR. */
function useMinWidth(px: number) {
  return useSyncExternalStore(
    (onChange) => { const m = window.matchMedia(`(min-width:${px}px)`); m.addEventListener('change', onChange); return () => m.removeEventListener('change', onChange); },
    () => window.matchMedia(`(min-width:${px}px)`).matches,
    () => false,
  );
}

const ProductCard = React.memo(function ProductCard({ product, priority, authStatus }: {
  product: ProductsListItem;
  priority: boolean;
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const [pending, setPending] = useState<'cart' | 'checkout' | null>(null);
  const [added, setAdded] = useState(false);
  const adding = useRef(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (addedTimer.current) clearTimeout(addedTimer.current); }, []);
  const meta = typeMeta[product.productType ?? 'PHYSICAL'];
  const TypeIcon = meta.icon;
  const outOfStock = product.productType !== 'DIGITAL' && product.stock === 0;
  const purchaseState = productPurchaseState(product);
  const href = `/products/${product.id}`;
  const sellerName = product.company?.name ?? product.user?.name ?? 'Independent seller';
  const sellerHref = product.company ? `/companies/${product.company.id}` : product.user ? `/profile/${product.user.id}` : null;
  const sellerInitial = sellerName.trim().charAt(0).toUpperCase() || '·';
  let validCurrency = false;
  try {
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: product.priceCurrency || 'USD' }).format(product.price);
    validCurrency = true;
  } catch { /* A malformed legacy listing must not crash the catalog or offer an ambiguous purchase. */ }
  const canBuy = purchaseState === 'AVAILABLE' && !outOfStock && validCurrency;

  async function add(destination: 'cart' | 'checkout') {
    if (adding.current || !canBuy) return;
    if (authStatus === 'loading') { toast.info('Checking your session…'); return; }
    if (authStatus !== 'authenticated') {
      toast.error('Sign in to add items to your basket', {
        action: { label: 'Sign in', onClick: () => router.push(`/auth/login?callbackUrl=${encodeURIComponent(href)}`) },
      });
      return;
    }
    adding.current = true;
    setPending(destination);
    try {
      const ok = await addItem(product.id);
      if (!ok) { toast.error('Could not add this product to your basket. Please try again.'); return; }
      if (destination === 'checkout') { router.push('/checkout'); return; }
      setAdded(true);
      toast.success('Added to basket', { action: { label: 'View basket', onClick: () => router.push('/cart') } });
      if (addedTimer.current) clearTimeout(addedTimer.current);
      addedTimer.current = setTimeout(() => setAdded(false), 2000);
    } catch {
      toast.error('Could not add this product to your basket. Please try again.');
    } finally { adding.current = false; setPending(null); }
  }

  const imageClass = 'object-cover transition-transform duration-700 ease-out motion-reduce:transition-none [@media(hover:hover)]:motion-safe:group-hover:scale-[1.05]';
  const arrowClass = 'flex size-10 border-border/60 bg-background/85 text-foreground shadow-e1 backdrop-blur-md opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 disabled:invisible';

  return (
    <article aria-label={product.title}
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/70 text-card-foreground shadow-e1 backdrop-blur-xl transition-[transform,box-shadow,border-color] duration-300 ease-out motion-reduce:transition-none hover:border-brand-accent/40 hover:shadow-e2 [@media(hover:hover)]:motion-safe:hover:-translate-y-1">
      <div className="relative overflow-hidden bg-foreground/[0.04]">
        {product.image.length ? <Carousel className="relative" aria-label={`${product.title} images`}>
          <CarouselContent>
            {product.image.map((source, index) => <CarouselItem key={source + index}>
              <Link href={href} aria-label={`View ${product.title}, image ${index + 1}`}
                className="relative block aspect-[4/3] w-full overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring">
                <Image src={source} alt={`${product.title} — preview ${index + 1}`} fill
                  sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 45vw, 360px"
                  preload={priority && index === 0} loading={priority && index === 0 ? undefined : 'lazy'}
                  className={imageClass} />
              </Link>
            </CarouselItem>)}
          </CarouselContent>
          {product.image.length > 1 && <>
            <CarouselPrevious aria-label={`Previous image of ${product.title}`} className={arrowClass} />
            <CarouselNext aria-label={`Next image of ${product.title}`} className={arrowClass} />
          </>}
        </Carousel> : <Link href={href} aria-label={`View ${product.title}`} className="flex aspect-[4/3] items-center justify-center"><Package className="size-12 text-muted-foreground" /><span className="sr-only">Preview unavailable</span></Link>}
        {/* Legibility scrim for the badges; never covers the whole image. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent" />
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
          <TypeIcon className="size-3.5" aria-hidden="true" />{meta.label}
        </span>
        {outOfStock && <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">Sold out</span>}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex h-6 min-w-0 items-center gap-2 text-[12px] text-muted-foreground">
          <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-accent/15 text-[10px] font-semibold text-brand-accent-hover dark:text-brand-accent-light">{sellerInitial}</span>
          {sellerHref
            ? <Link href={sellerHref} className="min-w-0 truncate rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">{sellerName}</Link>
            : <span className="min-w-0 truncate">{sellerName}</span>}
        </div>
        <h2 className="min-h-11 text-[15px] font-semibold leading-[1.4] tracking-tight">
          <Link href={href} className="line-clamp-2 rounded transition-colors hover:text-brand-accent-hover focus-visible:outline-2 focus-visible:outline-ring dark:hover:text-brand-accent-light">{product.title}</Link>
        </h2>
        <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{product.description}</p>
        <div className="mt-auto flex min-h-11 flex-wrap items-center justify-between gap-2">
          <span className="text-lg font-semibold tabular-nums tracking-tight"><PriceAmount amount={product.price} currency={product.priceCurrency || 'USD'} /></span>
          <span className="max-w-[45%] truncate rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[11px] font-medium capitalize text-muted-foreground">{product.category}</span>
        </div>
        {purchaseState !== 'AVAILABLE' ? <div className="mt-1 space-y-2">
          <p className="text-[12px] text-muted-foreground">{purchaseState === 'BROWSE_ONLY' ? 'Browse only · checkout not open' : 'Purchases paused'}</p>
          <Button asChild variant="outline" className="min-h-11 w-full rounded-full"><Link href={href} aria-label={`View details for ${product.title}`}>View details</Link></Button>
        </div> : <div className="flex gap-2">
          <button type="button" onClick={() => add('checkout')} disabled={!canBuy || pending !== null}
            className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-brand-accent px-4 text-sm font-semibold text-brand-accent-foreground shadow-e1 transition-[background-color,box-shadow,transform] duration-200 hover:bg-brand-accent-hover hover:shadow-[0_8px_24px_-12px_hsl(var(--brand-accent)/0.6)] motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:shadow-none">
            <ShoppingBag className="size-4" aria-hidden="true" />{pending === 'checkout' ? 'Preparing…' : outOfStock ? 'Sold out' : 'Buy now'}
          </button>
          <button type="button" onClick={() => add('cart')} disabled={!canBuy || pending !== null} aria-label={`Add ${product.title} to cart`}
            className={cn('grid size-11 shrink-0 place-items-center rounded-full border border-border/60 text-foreground transition-[background-color,border-color,color,transform] duration-200 hover:border-brand-accent/40 hover:bg-brand-accent/10 motion-safe:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', added && 'border-brand-accent/50 bg-brand-accent/15 text-brand-accent-hover dark:text-brand-accent-light')}>
            {added ? <Check className="size-4" aria-hidden="true" /> : <ShoppingCart className="size-4" aria-hidden="true" />}
          </button>
        </div>}
      </div>
    </article>
  );
});

function FilterChip({ label, onRemove }: { label: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-brand-accent/30 bg-brand-accent/10 pl-3 pr-1 text-[12px] font-medium text-foreground">
      <span className="max-w-[14rem] truncate">{label}</span>
      <button type="button" onClick={onRemove} aria-label="Remove filter" className="grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-3" aria-hidden="true" /></button>
    </span>
  );
}

export default function CatalogClient({ initialCatalog }: { initialCatalog: CatalogSnapshot | null }) {
  const { status: authStatus } = useCurrentUserWithStatus();
  const {
    selectedCategories, setSelectedCategories, selectedSellers, setSelectedSellers, sellers,
    minPrice, maxPrice, searchTerm, setSearchTerm, resetAllFilters, resetPriceFilters, activeFilterCount,
  } = useCategories();
  const { perPage, registerProductsFrame, isSidebarOpen, closeSidebar } = useSidebar();
  const isXl = useMinWidth(1280);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCategories.length) params.set('categories', selectedCategories.join(','));
    if (selectedSellers.length) params.set('sellerIds', selectedSellers.join(','));
    if (minPrice !== null) params.set('minPrice', String(minPrice));
    if (maxPrice !== null) params.set('maxPrice', String(maxPrice));
    if (searchTerm.trim()) params.set('searchTerm', searchTerm.trim());
    return params.toString();
  }, [selectedCategories, selectedSellers, minPrice, maxPrice, searchTerm]);
  const { products, loading, error, hasMore, loadMore, retry } = useProductListing(query, perPage, initialCatalog);
  const sellerName = (id: string) => sellers.find((s) => s.id === id)?.name ?? 'Seller';

  return <div className="min-h-full w-full bg-background text-foreground">
    <CatalogHeader />
    <div className="sticky top-0 z-40"><ProductsToolbar /></div>

    <div ref={registerProductsFrame} className={catalogFrame}>
      <div className="grid gap-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4 xl:grid-cols-[280px_minmax(0,1fr)] xl:gap-8 xl:pt-6">
        {/* Filter column: part of the frame, never a page shift. */}
        <aside className="hidden xl:block" aria-label="Filters">
          <div className="sticky top-[5.25rem] flex max-h-[calc(100dvh-var(--app-header-offset,72px)-var(--demo-notice-height,0px)-6.5rem)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-e1 backdrop-blur-xl">
            <CatalogFilters variant="inline" className="min-h-0 flex-1" />
          </div>
        </aside>

        <div className="@container min-w-0">
          <div className="flex min-h-12 flex-wrap items-center gap-2 pb-4">
            <p role="status" aria-live="polite" className="mr-auto text-sm text-muted-foreground">
              {loading ? products.length ? 'Updating products…' : 'Loading products…' : error ? 'Products could not be updated' : <><span className="font-semibold text-foreground">{products.length}{hasMore ? '+' : ''}</span> {products.length === 1 && !hasMore ? 'product' : 'products'}</>}
            </p>
            {searchTerm.trim() && <FilterChip label={<>“{searchTerm.trim()}”</>} onRemove={() => setSearchTerm('')} />}
            {selectedCategories.map((c) => <FilterChip key={`c:${c}`} label={<span className="capitalize">{c}</span>} onRemove={() => setSelectedCategories((prev) => prev.filter((v) => v !== c))} />)}
            {selectedSellers.map((s) => <FilterChip key={`s:${s}`} label={sellerName(s)} onRemove={() => setSelectedSellers((prev) => prev.filter((v) => v !== s))} />)}
            {(minPrice !== null || maxPrice !== null) && <FilterChip label={<><PriceAmount usd={minPrice ?? 0} render={(parts) => <>{parts.primaryText}</>} /> – {maxPrice !== null ? <PriceAmount usd={maxPrice} render={(parts) => <>{parts.primaryText}</>} /> : 'any'}</>} onRemove={resetPriceFilters} />}
            {activeFilterCount > 0 && <Button variant="ghost" className="min-h-9 rounded-full px-3 text-xs" onClick={resetAllFilters}>Clear all</Button>}
          </div>

          {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="min-w-0 flex-1 basis-64">{error}{products.length > 0 && ' Showing your previous results.'}</p>
            <Button variant="outline" className="min-h-11 rounded-full" onClick={retry}>Retry products</Button>
          </div>}

          <section aria-label="Product results" aria-busy={loading}>
            {loading && products.length === 0 && <ProductsSkeleton />}
            {!loading && !error && products.length === 0 && <div className="page-rise flex min-h-80 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-foreground/[0.02] p-8 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-foreground/[0.05] ring-1 ring-border/60"><Sparkles className="size-6 text-muted-foreground" aria-hidden="true" /></span>
              <h2 className="text-xl font-semibold tracking-tight">Nothing matches this view</h2>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">Try a different search, widen the price range, or clear the filters to browse everything.</p>
              {activeFilterCount > 0 && <Button className="min-h-11 rounded-full" onClick={resetAllFilters}>Show all products</Button>}
            </div>}
            {products.length > 0 && <div className={catalogGrid}>
              {products.map((product, index) => <ProductCard key={product.id} product={product} priority={index === 0} authStatus={authStatus} />)}
            </div>}
          </section>

          {hasMore && !error && <div className="flex justify-center pt-8">
            <Button variant="outline" className="min-h-11 rounded-full px-6" onClick={loadMore} disabled={loading}>{loading ? 'Loading more…' : 'Load more products'}</Button>
          </div>}
        </div>
      </div>
    </div>

    {/* Below xl the same panel slides in from the left and covers, never pushes. */}
    <Sheet open={isSidebarOpen && !isXl} onOpenChange={(open) => { if (!open) closeSidebar(); }}>
      <SheetContent side="left" accessibleTitle="Filters" accessibleDescription="Filter the marketplace by price, category and seller."
        className="flex w-[min(22rem,100%)] flex-col gap-0 border-r border-border/60 bg-popover p-0 sm:max-w-[22rem]">
        <CatalogFilters variant="sheet" onClose={closeSidebar} className="h-full" />
      </SheetContent>
    </Sheet>
  </div>;
}
