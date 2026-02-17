import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant loading shell for /products.
 *
 * This intentionally keeps the product-grid skeleton lightweight and
 * structurally identical to the real page so there is only ONE visual
 * "skeleton → content" transition instead of two competing designs.
 */
export default function ProductsLoading() {
  return (
    <div className="w-full min-h-full">
      {/* Header area shimmer — matches page.tsx header block */}
      <div className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6">
        <div className="py-6 space-y-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>

      {/* Toolbar area shimmer */}
      <div className="sticky top-0 z-50">
        <div className="border-b border-border/40 bg-background/80 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-2.5 flex items-center gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-7 rounded-full shrink-0"
                style={{ width: `${60 + i * 12}px` }}
              />
            ))}
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-8 w-48 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Product grid shimmer — same grid columns as real page */}
      <div className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-2 md:gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-black/5 dark:border-white/5 bg-muted/30 animate-pulse"
            >
              {/* Image area — matches ProductCard 1:1 aspect */}
              <div className="aspect-square rounded-t-lg bg-muted/50" />
              {/* Content area — matches ProductCard padding & line heights */}
              <div className="p-3 md:p-4 space-y-2.5">
                <div className="h-4 w-3/4 rounded bg-muted/60" />
                <div className="h-3 w-1/2 rounded bg-muted/40" />
                <div className="h-3 w-2/5 rounded bg-muted/30" />
                <div className="flex items-center justify-between pt-1">
                  <div className="h-4 w-4 rounded bg-muted/30" />
                  <div className="h-4 w-16 rounded bg-muted/50" />
                </div>
                <div className="h-9 w-full rounded-md bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
