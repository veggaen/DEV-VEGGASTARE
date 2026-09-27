/**
 * @fileOverview Catalog-only loading boundary; never inherited by product detail or offer routes.
 * @stability stable
 */
import ProductsSkeleton from '@/components/uicustom/skeletons/products-skeleton';
import { CatalogHeader, catalogFrame } from '@/components/uicustom/products/CatalogHeader';

export default function ProductsLoading() {
  return <div className="min-h-full w-full bg-background">
    <CatalogHeader />
    <div aria-hidden className="border-b border-border/60 bg-background/85">
      <div className={`${catalogFrame} flex gap-2 py-3`}>
        <div className="size-11 shrink-0 rounded-full bg-foreground/[0.06] sm:w-32" />
        <div className="h-11 min-w-0 flex-1 rounded-full bg-foreground/[0.06]" />
        <div className="size-11 shrink-0 rounded-full bg-foreground/[0.06] sm:w-24 xl:hidden" />
      </div>
    </div>
    <div className={catalogFrame}>
      <div className="grid gap-6 pb-10 pt-4 xl:grid-cols-[280px_minmax(0,1fr)] xl:gap-8 xl:pt-6">
        <div aria-hidden className="hidden h-[32rem] rounded-2xl border border-border/60 bg-card/70 xl:block" />
        <div className="@container min-w-0"><div className="min-h-12" /><ProductsSkeleton /></div>
      </div>
    </div>
  </div>;
}
