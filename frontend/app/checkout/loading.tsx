/** @fileOverview Checkout skeleton matches the digital order and summary geometry. @stability stable */
export default function CheckoutLoading() {
  return <div role="status" aria-label="Loading checkout" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <div className="h-11 w-24 rounded bg-muted motion-safe:animate-pulse" />
    <div className="mt-3 h-9 w-64 rounded bg-muted motion-safe:animate-pulse" />
    <div className="mt-2 h-6 max-w-sm rounded bg-muted motion-safe:animate-pulse" />
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)] lg:gap-8">
      <div className="space-y-6"><div className="h-72 rounded-2xl border border-border bg-muted/40 motion-safe:animate-pulse" /><div className="h-44 rounded-2xl border border-border bg-muted/40 motion-safe:animate-pulse" /></div>
      <div className="h-80 rounded-2xl border border-border bg-muted/40 motion-safe:animate-pulse" />
    </div>
  </div>;
}
