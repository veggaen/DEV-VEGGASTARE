/**
 * @fileOverview Catalog placeholders share the real card grid, image ratio and body dimensions.
 * @stability stable
 */
import { catalogGrid } from '@/components/uicustom/products/CatalogHeader';

export default function ProductsSkeleton() {
  return <div role="status" aria-label="Loading products">
    <span className="sr-only">Loading products…</span>
    <div aria-hidden className={catalogGrid}>
      {Array.from({ length: 8 }, (_, index) => <div key={index} className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 motion-safe:animate-pulse" style={{ animationDelay: `${index * 60}ms` }}>
        <div className="aspect-[4/3] bg-foreground/[0.06]" />
        <div className="flex flex-col gap-3 p-4">
          <div className="flex h-6 items-center gap-2"><div className="size-5 rounded-full bg-foreground/[0.08]" /><div className="h-3.5 w-24 rounded bg-foreground/[0.08]" /></div>
          <div className="h-11 space-y-2"><div className="h-4 w-4/5 rounded bg-foreground/[0.08]" /><div className="h-4 w-3/5 rounded bg-foreground/[0.08]" /></div>
          <div className="h-10 space-y-2"><div className="h-3 w-full rounded bg-foreground/[0.06]" /><div className="h-3 w-4/5 rounded bg-foreground/[0.06]" /></div>
          <div className="flex h-11 items-center justify-between"><div className="h-6 w-28 rounded bg-foreground/[0.08]" /><div className="h-5 w-16 rounded-full bg-foreground/[0.06]" /></div>
          <div className="flex gap-2"><div className="h-11 flex-1 rounded-full bg-foreground/[0.08]" /><div className="size-11 rounded-full bg-foreground/[0.06]" /></div>
        </div>
      </div>)}
    </div>
  </div>;
}
