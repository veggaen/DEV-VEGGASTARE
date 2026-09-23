/**
 * @fileOverview Catalog placeholders share the real card grid, image ratio and body dimensions.
 * @stability stable
 */
import { catalogGrid } from '@/components/uicustom/products/CatalogHeader';

export default function ProductsSkeleton() {
  return <div role="status" aria-label="Loading products">
    <span className="sr-only">Loading products…</span>
    <div aria-hidden className={catalogGrid}>
      {Array.from({ length: 8 }, (_, index) => <div key={index} className="overflow-hidden rounded-xl border border-border bg-card motion-safe:animate-pulse">
        <div className="aspect-[4/3] bg-muted" />
        <div className="flex flex-col gap-3 p-4">
          <div className="flex h-11 items-center"><div className="h-4 w-28 rounded bg-muted" /></div>
          <div className="h-12 space-y-2"><div className="h-4 w-4/5 rounded bg-muted" /><div className="h-4 w-3/5 rounded bg-muted" /></div>
          <div className="h-10 space-y-2"><div className="h-3 w-full rounded bg-muted" /><div className="h-3 w-4/5 rounded bg-muted" /></div>
          <div className="flex h-11 items-center"><div className="h-5 w-24 rounded bg-muted" /></div>
          <div className="flex gap-2"><div className="h-11 flex-1 rounded-lg bg-muted" /><div className="size-11 rounded-lg bg-muted" /></div>
        </div>
      </div>)}
    </div>
  </div>;
}
