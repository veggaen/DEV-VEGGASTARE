/** @fileOverview Checkout skeleton matches the digital order and summary geometry. @stability stable */
export default function CheckoutLoading() {
  return <div role="status" aria-label="Loading checkout" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="h-11 w-24 rounded bg-muted motion-safe:animate-pulse" />
    <div className="mt-3 h-9 w-64 rounded bg-muted motion-safe:animate-pulse" />
    <div className="mt-3 h-12 max-w-2xl rounded bg-muted motion-safe:animate-pulse" />
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="h-72 rounded-xl border bg-muted/40 motion-safe:animate-pulse" />
      <div className="h-80 rounded-xl border bg-muted/40 motion-safe:animate-pulse" />
    </div>
  </div>;
}
