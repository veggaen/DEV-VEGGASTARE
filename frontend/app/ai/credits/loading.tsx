/** @fileOverview Geometry-matched credit history loading state. @stability active */
export default function LoadingCreditHistory() {
  return <div role="status" aria-label="Loading credit history" className="mx-auto w-full max-w-4xl space-y-6 overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
    <div className="h-8 w-48 rounded bg-muted" /><div className="h-12 w-full rounded bg-muted" />
    <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map(item => <div key={item} className="h-28 rounded-xl border border-border bg-muted/40" />)}</div>
    <div className="h-36 rounded-xl bg-muted/40" /><div className="h-64 rounded-xl border border-border bg-muted/40" />
    <span className="sr-only">Loading credit history…</span>
  </div>;
}
