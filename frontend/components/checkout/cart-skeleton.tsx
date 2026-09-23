/** @fileOverview Shared route/data placeholders matching the cart's responsive geometry. @stability stable */
import { Skeleton } from "@/components/ui/skeleton";

export const cartCanvas = "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10";
export const cartColumns = "grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10";

export function CartHeader() {
  return <header className="mb-2 border-b border-border pb-6">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Marketplace</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Your cart</h1>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Review your items before checkout.</p>
  </header>;
}

export default function CartSkeleton() {
  return <div className={cartCanvas}>
    <CartHeader />
    <div role="status" aria-label="Loading cart" className={cartColumns}>
      <span className="sr-only">Loading your saved items…</span>
      <div aria-hidden="true" className="min-w-0 divide-y divide-border">
        {[0, 1].map(index => <div key={index} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-6 sm:grid-cols-[6rem_minmax(0,1fr)]">
          <Skeleton className="h-20 w-20 rounded-xl sm:h-24 sm:w-24" />
          <div className="min-w-0 space-y-3 py-1"><Skeleton className="h-6 w-full max-w-64" /><Skeleton className="h-5 w-28" /></div>
          <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:col-start-2">
            <Skeleton className="h-11 w-36" /><Skeleton className="h-11 w-24" />
          </div>
        </div>)}
      </div>
      <div aria-hidden="true" className="self-start rounded-2xl border border-border bg-surface-1 p-5 lg:mt-6 lg:p-6">
        <Skeleton className="h-6 w-24" /><Skeleton className="mt-6 h-5 w-full" /><Skeleton className="mt-5 h-8 w-full" />
        <Skeleton className="mt-5 h-12 w-full" /><Skeleton className="mt-4 h-10 w-full" />
      </div>
    </div>
  </div>;
}
