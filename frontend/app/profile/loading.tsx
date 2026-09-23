/** @fileOverview Profile loading geometry matches the bounded responsive profile canvas. @stability stable */
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return <section role="status" aria-label="Loading profile" className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-4xl">
      <Skeleton className="h-44 w-full rounded-2xl motion-reduce:animate-none sm:h-56 lg:h-64" />
      <div className="relative -mt-16 flex min-w-0 flex-col gap-4 sm:-mt-20 sm:flex-row sm:items-end sm:gap-6 sm:px-4">
        <Skeleton className="h-28 w-28 shrink-0 rounded-full ring-4 ring-background motion-reduce:animate-none sm:h-36 sm:w-36" />
        <div className="min-w-0 flex-1 space-y-3 py-2"><Skeleton className="h-7 w-44 max-w-full motion-reduce:animate-none" /><Skeleton className="h-4 w-32 max-w-full motion-reduce:animate-none" /></div>
        <Skeleton className="h-11 w-32 motion-reduce:animate-none" />
      </div>
      <div className="mt-6 space-y-4 sm:px-4"><Skeleton className="h-5 w-3/4 motion-reduce:animate-none" /><Skeleton className="h-5 w-1/2 motion-reduce:animate-none" /><Skeleton className="h-11 w-64 max-w-full motion-reduce:animate-none" /><div className="grid grid-cols-4 gap-1 rounded-xl bg-muted/30 p-1">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12 min-w-0 rounded-lg motion-reduce:animate-none" />)}</div><Skeleton className="h-56 w-full rounded-2xl motion-reduce:animate-none" /></div>
    </div>
  </section>;
}
