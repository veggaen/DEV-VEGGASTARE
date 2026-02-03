import { AspectRatio } from '@/components/ui/aspect-ratio';

export default function ProductSkeleton() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-6">
      <section className="grid lg:grid-cols-2 gap-6 lg:gap-10">
        {/* Gallery skeleton */}
        <div className="lg:sticky lg:top-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/40 p-2 animate-pulse">
            <AspectRatio ratio={1 / 1}>
              <div className="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 rounded-xl" />
            </AspectRatio>
          </div>
        </div>

        {/* Details skeleton */}
        <div className="flex flex-col gap-4">
          {/* Hero heading skeleton */}
          <div className="relative rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-gradient-to-br from-zinc-50/80 to-zinc-100/80 dark:from-zinc-900/50 dark:to-zinc-800/50 p-6 overflow-hidden animate-pulse">
            {/* Category badge */}
            <div className="inline-flex mb-3">
              <div className="h-6 w-40 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
            </div>
            {/* Title */}
            <div className="h-8 w-3/4 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            {/* Price */}
            <div className="h-7 w-48 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </div>

          {/* Rating */}
          <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />

          {/* Action buttons */}
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
            <div className="h-10 w-36 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
            <div className="h-10 w-40 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
          </div>

          {/* Shipping box */}
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4 animate-pulse">
            <div className="h-5 w-24 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
            <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-700 rounded" />
          </div>

          {/* Availability boxes */}
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 animate-pulse">
              <div className="h-5 w-28 bg-zinc-200 dark:bg-zinc-700 rounded mb-2" />
              <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-700 rounded" />
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 animate-pulse">
              <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-700 rounded mb-2" />
              <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded" />
            </div>
          </div>

          {/* Description */}
          <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-800 p-4 animate-pulse">
            <div className="space-y-2">
              <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-700 rounded" />
              <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-700 rounded" />
              <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-700 rounded" />
            </div>
          </div>
        </div>
      </section>

      {/* Specifications skeleton */}
      <section className="mt-8 rounded-2xl bg-zinc-100/60 dark:bg-gray-800/50 border border-zinc-200 dark:border-gray-800 p-6 animate-pulse">
        <div className="h-6 w-36 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-700 rounded mb-2" />
              <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}