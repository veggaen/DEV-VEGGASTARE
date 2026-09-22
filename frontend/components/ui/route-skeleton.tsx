/** @fileOverview Shared accessible route loading shells. @stability stable */
import { Skeleton } from "@/components/ui/skeleton";

/** Lightweight fallback for routes without a more specific loading shell. */
export function RouteSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="mx-auto w-full max-w-6xl px-4 py-8">
      <span className="sr-only">Loading page…</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map(index => (
            <div key={index} className="min-h-64 rounded-2xl border border-border/50 bg-card/40 p-5 space-y-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Visible while client-only wallet dependencies initialize. */
export function AppBootSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <div aria-hidden="true" className="h-16 border-b border-border/50 flex items-center justify-between px-5">
        <span className="font-semibold tracking-tight">VeggaStare</span>
        <div className="flex gap-3"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-8 rounded-full" /></div>
      </div>
      <RouteSkeleton />
    </div>
  );
}
