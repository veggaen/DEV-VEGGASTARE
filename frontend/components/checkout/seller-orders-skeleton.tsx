/** @fileOverview Stable Sales loading geometry without false zero metrics. @stability stable */
export function SalesOrdersSkeleton() {
  return <div role="status" aria-label="Loading sales" className="space-y-5">
    <span className="sr-only">Loading sales…</span>
    <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
      <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map(key => <div key={key} className="h-28 rounded-xl border bg-muted/30 p-5"><div className="h-3 w-28 rounded bg-muted" /><div className="mt-4 h-7 w-20 rounded bg-muted" /></div>)}</div>
      <div className="flex flex-wrap gap-2">{[0, 1, 2, 3, 4].map(key => <div key={key} className="h-11 w-24 rounded-lg bg-muted/50" />)}</div>
      <SalesRowsSkeleton />
    </div>
  </div>;
}

export function SalesRowsSkeleton() {
  return <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">{[0, 1, 2].map(key => <div key={key} className="h-32 rounded-xl border bg-muted/20 p-5"><div className="h-4 w-40 rounded bg-muted" /><div className="mt-4 h-3 w-28 rounded bg-muted" /></div>)}</div>;
}
