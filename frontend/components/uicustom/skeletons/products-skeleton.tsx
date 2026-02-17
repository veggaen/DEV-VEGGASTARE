/**
 * Skeleton shown inside /products page.tsx while the first batch of products
 * is fetching. Structurally mirrors the real ProductCard so the transition
 * from skeleton → real content is seamless with zero layout shift.
 */
export default function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-5 gap-2 md:gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-lg border border-black/10 dark:border-white/10 bg-white/35 dark:bg-white/[0.02]"
        >
          {/* Image area — 1:1 matching ProductCard carousel */}
          <div className="relative">
            <div className="aspect-square bg-muted/50 animate-pulse" />
            {/* Category badge placeholder */}
            <div className="absolute left-3 bottom-3">
              <div className="h-5 w-16 rounded-sm bg-black/20 animate-pulse" />
            </div>
          </div>

          {/* Content area — mirrors ProductCard p-3 md:p-4 */}
          <div className="p-3 md:p-4 flex flex-col gap-2 grow">
            {/* Title */}
            <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
            {/* Description */}
            <div className="h-3 w-full rounded bg-muted/70 animate-pulse" />
            {/* Seller line */}
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-10 rounded bg-muted/50 animate-pulse" />
              <div className="h-3 w-20 rounded bg-muted/60 animate-pulse" />
            </div>

            {/* Price + star row */}
            <div className="mt-auto flex items-center justify-between gap-3">
              <div className="h-4 w-4 rounded bg-muted/40 animate-pulse" />
              <div className="h-4 w-16 rounded bg-muted/60 animate-pulse" />
            </div>

            {/* View button */}
            <div className="h-9 w-full rounded-md bg-muted/50 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}