/**
 * @fileOverview Responsive marketplace; its route group scopes loading to the catalog only.
 * @stability stable
 */
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Layers, Package, ShoppingBag, ShoppingCart, Zap } from 'lucide-react';
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
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import ProductsSkeleton from '@/components/uicustom/skeletons/products-skeleton';
import { ProductsToolbar } from '@/components/uicustom/products/ProductsToolbar';
import { CatalogHeader, catalogFrame, catalogGrid } from '@/components/uicustom/products/CatalogHeader';
import PriceAmount from '@/components/crypto-related/PriceAmount';

const typeMeta = {
  DIGITAL: { label: 'Digital', icon: Zap },
  PHYSICAL: { label: 'Physical', icon: Package },
  HYBRID: { label: 'Hybrid', icon: Layers },
};

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
  const href = `/products/${product.id}`;
  const sellerName = product.company?.name ?? product.user?.name ?? 'Independent seller';
  const sellerHref = product.company ? `/companies/${product.company.id}` : product.user ? `/profile/${product.user.id}` : null;
  let validCurrency = false;
  try {
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: product.priceCurrency || 'USD' }).format(product.price);
    validCurrency = true;
  } catch { /* A malformed legacy listing must not crash the catalog or offer an ambiguous purchase. */ }

  async function add(destination: 'cart' | 'checkout') {
    if (adding.current || outOfStock || !validCurrency) return;
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

  return (
    <article aria-label={product.title} className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm motion-safe:transition-transform motion-safe:duration-200 [@media(hover:hover)]:motion-safe:hover:-translate-y-1">
      <div className="relative overflow-hidden bg-muted">
        {product.image.length ? <Carousel className="relative" aria-label={`${product.title} images`}>
          <CarouselContent>
            {product.image.map((source, index) => <CarouselItem key={source + index}>
              <Link href={href} aria-label={`View ${product.title}, image ${index + 1}`}
                className="relative block aspect-[4/3] w-full overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring">
                <Image src={source} alt={`${product.title} — preview ${index + 1}`} fill
                  sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 45vw, 400px"
                  preload={priority && index === 0} loading={priority && index === 0 ? undefined : 'lazy'}
                  className="object-cover motion-safe:transition-transform motion-safe:duration-200 [@media(hover:hover)]:motion-safe:group-hover:scale-[1.025]" />
              </Link>
            </CarouselItem>)}
          </CarouselContent>
          {product.image.length > 1 && <>
            <CarouselPrevious aria-label={`Previous image of ${product.title}`} className="flex size-11 border-white/20 bg-black/70 text-white disabled:invisible" />
            <CarouselNext aria-label={`Next image of ${product.title}`} className="flex size-11 border-white/20 bg-black/70 text-white disabled:invisible" />
          </>}
        </Carousel> : <Link href={href} aria-label={`View ${product.title}`} className="flex aspect-[4/3] items-center justify-center"><Package className="size-12 text-muted-foreground" /><span className="sr-only">Preview unavailable</span></Link>}
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-background/95 px-2 py-1 text-xs font-medium shadow-sm">
          <TypeIcon className="size-3.5" aria-hidden />{meta.label}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex h-11 min-w-0 items-center text-sm text-muted-foreground">
          {sellerHref ? <Link href={sellerHref} className="flex min-h-11 min-w-0 items-center rounded focus-visible:outline-2 focus-visible:outline-ring"><span className="truncate">{sellerName}</span></Link> : <span className="truncate">{sellerName}</span>}
        </div>
        <h2 className="min-h-12 text-base font-semibold leading-6"><Link href={href} className="line-clamp-2 rounded focus-visible:outline-2 focus-visible:outline-ring">{product.title}</Link></h2>
        <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{product.description}</p>
        <div className="mt-auto flex min-h-11 flex-wrap items-center justify-between gap-2">
          <span className="text-lg font-semibold tabular-nums"><PriceAmount amount={product.price} currency={product.priceCurrency || 'USD'} /></span>
          <span className="text-xs text-muted-foreground">{outOfStock ? 'Out of stock' : product.category}</span>
        </div>
        <div className="flex gap-2">
          <Button className="min-h-11 min-w-0 flex-1 gap-2" onClick={() => add('checkout')} disabled={outOfStock || !validCurrency || pending !== null}>
            <ShoppingBag className="size-4" aria-hidden />{pending === 'checkout' ? 'Preparing…' : 'Buy now'}
          </Button>
          <Button variant="outline" size="icon" className="size-11 shrink-0" onClick={() => add('cart')} disabled={outOfStock || !validCurrency || pending !== null}
            aria-label={`Add ${product.title} to cart`}>
            {added ? <Check className="size-4" aria-hidden /> : <ShoppingCart className="size-4" aria-hidden />}
          </Button>
        </div>
      </div>
    </article>
  );
});

export default function ProductsPage() {
  const { status: authStatus } = useCurrentUserWithStatus();
  const { selectedCategories, selectedSellers, minPrice, maxPrice, searchTerm, resetAllFilters, activeFilterCount } = useCategories();
  const { perPage, registerProductsFrame } = useSidebar();
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCategories.length) params.set('categories', selectedCategories.join(','));
    if (selectedSellers.length) params.set('sellerIds', selectedSellers.join(','));
    if (minPrice !== null) params.set('minPrice', String(minPrice));
    if (maxPrice !== null) params.set('maxPrice', String(maxPrice));
    if (searchTerm.trim()) params.set('searchTerm', searchTerm.trim());
    return params.toString();
  }, [selectedCategories, selectedSellers, minPrice, maxPrice, searchTerm]);
  const { products, loading, error, hasMore, loadMore, retry } = useProductListing(query, perPage);

  return <div className="min-h-full w-full bg-background text-foreground">
    <CatalogHeader />
    <div className="sticky top-0 z-50"><ProductsToolbar /></div>
    <div ref={registerProductsFrame} className={catalogFrame}>
      <div className="@container pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex min-h-14 items-center justify-between gap-3 py-2">
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {loading ? products.length ? 'Updating products…' : 'Loading products…' : error ? 'Products could not be updated' : `${products.length}${hasMore ? '+' : ''} products`}
          </p>
          {activeFilterCount > 0 && <Button variant="ghost" className="min-h-11" onClick={resetAllFilters}>Clear filters</Button>}
        </div>
        {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="min-w-0 flex-1 basis-64">{error}{products.length > 0 && ' Showing your previous results.'}</p>
          <Button variant="outline" className="min-h-11" onClick={retry}>Retry products</Button>
        </div>}
        <section aria-label="Product results" aria-busy={loading}>
          {loading && products.length === 0 && <ProductsSkeleton />}
          {!loading && !error && products.length === 0 && <div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-6 text-center">
            <Package className="size-8 text-muted-foreground" aria-hidden />
            <h2 className="text-xl font-semibold">No products match this view</h2>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">Try a different search or clear your filters to browse the marketplace.</p>
            {activeFilterCount > 0 && <Button className="min-h-11" onClick={resetAllFilters}>Show all products</Button>}
          </div>}
          {products.length > 0 && <div className={catalogGrid}>
            {products.map((product, index) => <ProductCard key={product.id} product={product} priority={index === 0} authStatus={authStatus} />)}
          </div>}
        </section>
        {hasMore && !error && <div className="flex justify-center pt-6">
          <Button variant="outline" className="min-h-11" onClick={loadMore} disabled={loading}>{loading ? 'Loading more…' : 'Load more products'}</Button>
        </div>}
      </div>
    </div>
  </div>;
}
