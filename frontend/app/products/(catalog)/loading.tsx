/**
 * @fileOverview Catalog-only loading boundary; never inherited by product detail or offer routes.
 * @stability stable
 */
import ProductsSkeleton from '@/components/uicustom/skeletons/products-skeleton';
import { CatalogHeader, catalogFrame } from '@/components/uicustom/products/CatalogHeader';

export default function ProductsLoading() {
  return <div className="min-h-full w-full bg-background">
    <CatalogHeader />
    <div aria-hidden className="border-y border-border bg-background">
      <div className={`${catalogFrame} flex gap-2 py-3`}>
        <div className="size-11 shrink-0 rounded-lg bg-muted sm:w-32" />
        <div className="h-11 min-w-0 flex-1 rounded-lg bg-muted" />
        <div className="size-11 shrink-0 rounded-lg bg-muted sm:w-24" />
        <div className="hidden size-11 shrink-0 rounded-lg bg-muted lg:block" />
      </div>
    </div>
    <div className={catalogFrame}><div className="@container pb-8"><div className="min-h-14" /><ProductsSkeleton /></div></div>
  </div>;
}
