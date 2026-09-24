import { AspectRatio } from '@/components/ui/aspect-ratio';

export default function ProductSkeleton() {
  return (
    <div role="status" aria-label="Loading product" className="w-full min-w-0 space-y-6">
      <span className="sr-only">Loading product</span>
      <div aria-hidden className="h-11 w-36 rounded-lg bg-muted motion-safe:animate-pulse" />
      <section aria-hidden className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Gallery skeleton */}
        <div className="min-w-0 lg:col-span-7">
          <div className="rounded-xl border border-border bg-card p-3 motion-safe:animate-pulse">
            <AspectRatio ratio={3 / 2}>
              <div className="w-full h-full bg-linear-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 rounded-xl" />
            </AspectRatio>
          </div>
          <div className="mt-3 flex h-16 gap-2" aria-hidden>
            <div className="h-14 w-20 rounded-lg bg-muted motion-safe:animate-pulse" />
            <div className="h-14 w-20 rounded-lg bg-muted motion-safe:animate-pulse" />
          </div>
        </div>

        {/* Details skeleton */}
        <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-border p-4 sm:p-6 lg:col-span-5">
          {/* Hero heading skeleton */}
          <div className="relative overflow-hidden motion-safe:animate-pulse">
            {/* Category badge */}
            <div className="inline-flex mb-3">
              <div className="h-6 w-40 bg-muted rounded-full" />
            </div>
            {/* Title */}
            <div className="h-8 w-3/4 bg-muted rounded mb-4" />
            {/* Price */}
            <div className="h-7 w-48 bg-muted rounded" />
          </div>

          {/* Rating */}
          <div className="h-6 w-32 bg-muted rounded motion-safe:animate-pulse" />

          {/* Action buttons */}
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
            <div className="h-12 bg-muted rounded motion-safe:animate-pulse" />
            <div className="h-12 bg-muted rounded motion-safe:animate-pulse" />
            <div className="hidden h-12 bg-muted rounded motion-safe:animate-pulse lg:block" />
          </div>

          {/* Shipping box */}
          <div className="mt-4 rounded-xl border border-border p-4 motion-safe:animate-pulse">
            <div className="h-5 w-24 bg-muted rounded mb-3" />
            <div className="h-4 w-full bg-muted rounded" />
          </div>

        </div>
      </section>

      <section aria-hidden className="grid gap-4 border-t border-border py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-8">
        <div className="h-6 w-36 rounded bg-muted motion-safe:animate-pulse" />
        <div className="space-y-3 motion-safe:animate-pulse">
          <div className="h-4 rounded bg-muted" /><div className="h-4 rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
        </div>
      </section>

      {/* Specifications skeleton */}
      <section aria-hidden className="mt-8 rounded-2xl bg-zinc-100/60 dark:bg-gray-800/50 border border-border p-6 motion-safe:animate-pulse">
        <div className="h-6 w-36 bg-muted rounded mb-4" />
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="h-3 w-20 bg-muted rounded mb-2" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
