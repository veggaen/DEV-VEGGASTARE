import { FeedSkeleton, Skeleton } from "@/components/ui/skeleton";

/**
 * Instant route-level skeleton for /pulse. The Pulse feed is a heavy client
 * bundle; this gives an immediate, content-shaped placeholder on navigation
 * (composer + feed column + trending sidebar) so the tab never feels frozen.
 */
export default function PulseLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Tab row */}
      <div className="mb-5 flex items-center gap-4">
        {[14, 12, 10, 16].map((w, i) => (
          <Skeleton key={i} className="h-4 animate-pulse rounded" style={{ width: `${w * 6}px` }} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Feed column */}
        <div className="min-w-0 space-y-3">
          {/* Composer */}
          <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <Skeleton className="h-10 flex-1 rounded-full" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-6 w-6 rounded-md" />
                ))}
              </div>
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </div>
          <FeedSkeleton count={4} />
        </div>

        {/* Trending sidebar (desktop only) */}
        <aside className="hidden space-y-4 lg:block">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border/50 bg-card/30 p-4" style={{ opacity: Math.max(0.5, 1 - i * 0.15) }}>
              <Skeleton className="h-4 w-28 rounded" />
              <div className="mt-3 space-y-2">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
