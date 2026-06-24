/**
 * Instant route-level skeleton for /ai.
 *
 * The page is an async server component that awaits auth before rendering, so
 * without this the AI tab feels frozen on navigation. This skeleton mirrors the
 * real AiEmptyState layout (icon tile → eyebrow → headline → 4 starter cards →
 * CTA) so the swap to real content is a single, shift-free transition.
 */
export default function AiLoading() {
  return (
    <div className="h-full grid place-items-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        {/* Icon tile */}
        <div className="mx-auto mb-5 h-14 w-14 animate-pulse rounded-2xl bg-muted/60" />
        {/* Eyebrow */}
        <div className="mx-auto h-3 w-24 animate-pulse rounded bg-muted/50" />
        {/* Headline */}
        <div className="mx-auto mt-3 h-7 w-64 max-w-full animate-pulse rounded bg-muted/60" />
        {/* Subtitle */}
        <div className="mx-auto mt-3 h-3 w-48 animate-pulse rounded bg-muted/40" />

        {/* Starter cards — 2×2 */}
        <div className="mt-7 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-2xl border border-black/6 px-4 py-3.5 dark:border-white/8"
              style={{ opacity: Math.max(0.45, 1 - i * 0.12) }}
            >
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted/60" />
              <div className="min-w-0 flex-1 space-y-2 py-0.5">
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted/60" />
                <div className="h-3 w-full animate-pulse rounded bg-muted/40" />
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mx-auto mt-5 h-11 w-40 animate-pulse rounded-xl bg-muted/50" />
      </div>
    </div>
  );
}
