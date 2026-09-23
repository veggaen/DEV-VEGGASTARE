'use client';

import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useFetchUserProductCreationAnalytics } from '@/hooks/useFetchUserProductCreationAnalytics';

type PublishingCount = { label: string; count: number };
const sample: PublishingCount[] = [
  { label: 'Independent seller products', count: 42 },
  { label: 'Company products', count: 18 },
];

function Counts({ data }: { data: PublishingCount[] }) {
  return <dl className="grid grid-cols-2 gap-3">
    {data.map(item => <div key={item.label} className="min-w-0 rounded-xl border border-border p-4">
      <dt className="text-sm leading-relaxed text-muted-foreground">{item.label}</dt>
      <dd className="mt-2 text-2xl font-semibold tabular-nums">{item.count.toLocaleString('en-GB')}</dd>
    </div>)}
  </dl>;
}

function CountSkeleton() {
  return <div role="status" aria-label="Loading publishing mix" className="grid grid-cols-2 gap-3">
    <div className="h-28 rounded-xl bg-muted motion-safe:animate-pulse" />
    <div className="h-28 rounded-xl bg-muted motion-safe:animate-pulse" />
  </div>;
}

function LiveCounts({ userId }: { userId: string }) {
  const { data, loading, refreshing, error, retry } = useFetchUserProductCreationAnalytics(userId);
  if (loading) return <CountSkeleton />;
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Current platform totals · administrator access. Independent of the date range above.</p>
    {error && <div role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm">
      <p>{error}</p>{data && <p className="mt-1 text-muted-foreground">Showing the last successfully loaded publishing mix.</p>}
    </div>}
    {data && <Counts data={data} />}
    <Button variant="outline" size="touch" disabled={refreshing} onClick={retry}>
      {refreshing ? 'Refreshing…' : error ? 'Retry publishing mix' : 'Refresh publishing mix'}
    </Button>
  </div>;
}

export default function UserProductCreationChart() {
  const { data: session, status } = useSession();
  return <section aria-labelledby="publishing-mix-title" className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
    <div className="space-y-2">
      <h2 id="publishing-mix-title" className="text-lg font-semibold">Product publishing mix</h2>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Product counts by publisher type, not unique sellers or revenue.</p>
    </div>
    {status === 'loading' ? <CountSkeleton /> : session?.user?.role === 'ADMIN' && session.user.id
      ? <LiveCounts key={session.user.id} userId={session.user.id} />
      : <><p className="text-sm text-muted-foreground">Illustrative publishing mix · fictional counts, independent of the date range above.</p><Counts data={sample} /></>}
  </section>;
}
