'use client';
/** @fileOverview Accessible experimental request browser with account-scoped caching. @stability experimental */

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PriceAmount from '@/components/crypto-related/PriceAmount';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { JobRequestsListResponseSchema } from '@/lib/types/job-requests';

async function fetchRequests([url]: readonly [string, string]) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(response.status === 401
    ? 'Your session has expired. Sign in again to browse requests.'
    : 'Check your connection and try again.');
  const result = JobRequestsListResponseSchema.safeParse(await response.json());
  if (!result.success) throw new Error('The request list is temporarily unavailable. Please try again.');
  return result.data;
}

const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
function requestDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date);
}

export default function JobsPage() {
  const { user, isLoading: sessionLoading } = useCurrentUserWithStatus();
  const searchParams = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const sort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const [visibleCount, setVisibleCount] = useState(50);
  // Never reuse another account's private/company requests after a session change.
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    user?.id ? ['/api/job-requests', user.id] as const : null,
    fetchRequests,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const requests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data ?? []).filter(job => !query
      || job.title?.toLowerCase().includes(query)
      || job.descriptions.some(description => description.toLowerCase().includes(query))
      || job.additionalNotes?.toLowerCase().includes(query))
      .sort((a, b) => {
        const difference = (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0);
        return sort === 'oldest' ? difference : -difference;
      });
  }, [data, search, sort]);
  const initialLoading = sessionLoading || (isLoading && !data);

  function updateFilter(key: 'q' | 'sort', value: string) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    setVisibleCount(50);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Experimental · Job board</p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Browse requests</h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">
          Explore requests for products, services, and custom work. This experimental board is separate from the marketplace and does not process project payments.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-2">
          <label htmlFor="request-search" className="text-sm font-medium">Search requests</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <input id="request-search" name="q" type="search" autoComplete="off" value={search}
              onChange={event => updateFilter('q', event.target.value)} placeholder="Search titles and descriptions…"
              className="h-11 w-full min-w-0 rounded-lg border border-input bg-background pl-10 pr-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="request-sort" className="text-sm font-medium">Sort requests</label>
          <select id="request-sort" name="sort" value={sort} onChange={event => updateFilter('sort', event.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button asChild className="min-h-11"><Link href="/jobs/post">Post request</Link></Button>
          <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={!user || isValidating}
            onClick={() => void mutate()}>
            <RefreshCw aria-hidden="true" className={isValidating ? 'h-4 w-4 animate-spin motion-reduce:animate-none' : 'h-4 w-4'} />
            {isValidating && data ? 'Refreshing…' : 'Refresh requests'}
          </Button>
        </div>
      </div>

      {!sessionLoading && !user ? (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold">Sign in to browse requests</h2>
          <Button asChild className="mt-4 min-h-11"><Link href="/auth/login?callbackUrl=%2Fjobs">Sign in</Link></Button>
        </section>
      ) : (
        <>
          {error && (
            <section role="alert" className="space-y-3 rounded-xl border border-destructive/40 bg-card p-5">
              <h2 className="font-semibold">Could not load requests</h2>
              <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Please try again.'}</p>
              {data && <p className="text-sm text-muted-foreground">Your last loaded results are still shown below.</p>}
              <Button type="button" variant="outline" className="min-h-11" disabled={isValidating} onClick={() => void mutate()}>Try again</Button>
            </section>
          )}
          {initialLoading ? (
            <div role="status" aria-label="Loading requests" className="space-y-4">
              <span className="sr-only">Loading requests…</span>
              {[0, 1, 2].map(index => (
                <div key={index} aria-hidden="true" className="min-h-40 space-y-3 rounded-xl border border-border bg-card p-5">
                  <Skeleton className="h-4 w-32" /><Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : data && requests.length === 0 ? (
            <section className="rounded-xl border border-border bg-card px-5 py-12 text-center">
              <h2 className="text-lg font-semibold">{search.trim() ? 'No matching requests' : 'No requests yet'}</h2>
              <p className="mt-2 text-muted-foreground">{search.trim() ? 'Try a different search or clear the filter.' : 'New public requests and requests shared with your companies will appear here.'}</p>
              {search.trim() && <Button type="button" variant="outline" className="mt-5 min-h-11" onClick={() => updateFilter('q', '')}>Clear search</Button>}
            </section>
          ) : data ? (
            <div className="space-y-4">
              <p role="status" className="text-sm tabular-nums text-muted-foreground">
                {requests.length} request{requests.length === 1 ? '' : 's'}{isValidating ? ' · Updating…' : ''}
              </p>
              <ul aria-label="Job requests" className="space-y-4">
                {requests.slice(0, visibleCount).map(job => (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`} className="group flex min-h-40 min-w-0 gap-4 rounded-xl border border-border bg-card p-5 outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{job.user.name || 'Member'} · {requestDate(job.createdAt)}</p>
                        <h2 className="text-lg font-semibold [overflow-wrap:anywhere]">{job.title || `Request #${job.id.slice(0, 8)}`}</h2>
                        <p className="line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">{job.descriptions[0] || 'Open this request for details.'}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          {job.price != null && <span>Budget: <PriceAmount usd={job.price} /></span>}
                          {job.negotiable && <span className="text-muted-foreground">Negotiable</span>}
                          {job.images.length > 0 && <span className="text-muted-foreground">{job.images.length} image{job.images.length === 1 ? '' : 's'}</span>}
                        </div>
                      </div>
                      {job.images[0] && <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-24">
                        <Image src={job.images[0]} alt="" fill sizes="(min-width: 640px) 96px, 64px" className="object-cover" />
                      </div>}
                    </Link>
                  </li>
                ))}
              </ul>
              {requests.length > visibleCount && <Button type="button" variant="outline" className="min-h-11" onClick={() => setVisibleCount(count => count + 50)}>Show more requests</Button>}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
