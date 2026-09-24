'use client';
/** Navigation and data loading use the same product-specific geometry. */
import { usePathname } from 'next/navigation';
import ProductSkeleton from '@/components/uicustom/skeletons/product-skeleton';
import SiteFooter from '@/components/uicustom/site-footer';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';

export default function ProductLoading() {
  const pathname = usePathname();
  return <div data-product-detail className="relative isolate flex min-h-full w-full flex-col overflow-hidden bg-background text-foreground">
    <div className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 lg:px-8">
      <ProductSkeleton credits={pathname === `/products/${SHOWCASE_PRODUCTS.credits.id}`} />
    </div>
    <div className="relative pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0"><SiteFooter /></div>
  </div>;
}
