'use client';
/** @fileOverview Accessible experimental request browser with account-scoped caching. @stability experimental */

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Image as ImageIcon, Plus, RefreshCw, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PriceAmount from '@/components/crypto-related/PriceAmount';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { readJobRequests } from '@/lib/job-requests-read';
import { PageHeader } from '@/components/uicustom/chrome/page-header';
import { HoverChaser } from '@/components/uicustom/chrome/hover-chaser';
import { StatusPill, fieldClass } from '@/components/uicustom/settings/settings-primitives';
import { cn } from '@/lib/utils';

const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
function requestDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date);
}
const card = 'min-w-0 rounded-2xl border border-border/60 bg-card/70 shadow-e1 backdrop-blur-xl';

export default function JobsPage() {
  const { user, isLoading: sessionLoading } = useCurrentUserWithStatus();
  const searchParams = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const sort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const [visibleCount, setVisibleCount] = useState(50);
  // Never reuse another account's private/company requests after a session change.
  const { data: read, error, isLoading, isValidating, mutate } = useSWR(
    user?.id ? ['/api/job-requests', user.id] as const : null,
    readJobRequests,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const data = read?.data;
  const accessError = read?.accessError;
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
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Job board · Experimental"
        title="Browse requests"
        description="Requests for products, services and custom work from people and companies. Reply with an offer; the board never processes payments."
        actions={<>
          <Button type="button" variant="vegaNormalBtn" className="min-h-11 gap-2" disabled={!user || isValidating} onClick={() => void mutate()}>
            <RefreshCw aria-hidden="true" className={cn('size-4', isValidating && 'motion-safe:animate-spin')} />
            {isValidating && data ? 'Refreshing…' : 'Refresh requests'}
          </Button>
          <Button asChild variant="vegaEmeraldBtn" className="min-h-11 gap-2"><Link href="/jobs/post"><Plus aria-hidden="true" className="size-4" />Post request</Link></Button>
        </>}
      >
        <div className={cn(card, 'grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_200px]')}>
          <div className="min-w-0">
            <label htmlFor="request-search" className="sr-only">Search requests</label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input id="request-search" name="q" type="search" autoComplete="off" value={search}
                onChange={event => updateFilter('q', event.target.value)} placeholder="Search titles and descriptions…"
                className={cn(fieldClass, 'h-11 w-full min-w-0 border pl-10 pr-3 outline-none')} />
            </div>
          </div>
          <div>
            <label htmlFor="request-sort" className="sr-only">Sort requests</label>
            <select id="request-sort" name="sort" value={sort} onChange={event => updateFilter('sort', event.target.value)}
              className={cn(fieldClass, 'h-11 w-full border px-3 text-foreground outline-none')}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
      </PageHeader>

      {!sessionLoading && !user ? (
        <section className={cn(card, 'p-6')}>
          <h2 className="font-semibold">Sign in to browse requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">Requests are visible to members and the companies they are sent to.</p>
          <Button asChild variant="vegaEmeraldBtn" className="mt-4 min-h-11"><Link href="/auth/login?callbackUrl=%2Fjobs">Sign in</Link></Button>
        </section>
      ) : (
        <>
          {(error || accessError) && (
            <section role="alert" className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
              <h2 className="font-semibold">Could not load requests</h2>
              <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : accessError || 'Please try again.'}</p>
              {data && <p className="text-sm text-muted-foreground">Your last loaded results are still shown below.</p>}
              <Button type="button" variant="vegaNormalBtn" className="min-h-11" disabled={isValidating} onClick={() => void mutate()}>Try again</Button>
            </section>
          )}
          {initialLoading ? (
            <div role="status" aria-label="Loading requests" className="space-y-3">
              <span className="sr-only">Loading requests…</span>
              {[0, 1, 2].map(index => (
                <div key={index} aria-hidden="true" className={cn(card, 'min-h-36 space-y-3 p-5')} style={{ opacity: 1 - index * 0.22 }}>
                  <Skeleton className="h-3.5 w-32" /><Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-1/2" />
                </div>
              ))}
            </div>
          ) : data && requests.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-border/70 px-5 py-12 text-center">
              <Sparkles aria-hidden="true" className="mx-auto mb-3 size-7 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{search.trim() ? 'No matching requests' : 'No requests yet'}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{search.trim() ? 'Try a different search or clear the filter.' : 'New public requests and requests shared with your companies will appear here.'}</p>
              {search.trim() ? <Button type="button" variant="vegaNormalBtn" className="mt-5 min-h-11" onClick={() => updateFilter('q', '')}>Clear search</Button>
                : <Button asChild variant="vegaEmeraldBtn" className="mt-5 min-h-11"><Link href="/jobs/post">Post the first request</Link></Button>}
            </section>
          ) : data ? (
            <div className="space-y-3">
              <p role="status" className="text-sm tabular-nums text-muted-foreground">
                {requests.length} request{requests.length === 1 ? '' : 's'}{isValidating ? ' · Updating…' : ''}
              </p>
              <HoverChaser as="ul" aria-label="Job requests" className="space-y-3" boxClassName="rounded-2xl">
                {requests.slice(0, visibleCount).map(job => (
                  <li key={job.id} data-chase className={card}>
                    <Link href={`/jobs/${job.id}`} className="group flex min-h-32 min-w-0 gap-4 rounded-2xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5">
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{job.user.name || 'Member'} · {requestDate(job.createdAt)}</p>
                        <h2 className="text-base font-semibold leading-snug [overflow-wrap:anywhere] sm:text-lg">{job.title || `Request #${job.id.slice(0, 8)}`}</h2>
                        <p className="line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">{job.descriptions[0] || 'Open this request for details.'}</p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {job.price != null && <StatusPill tone="accent">Budget <PriceAmount usd={job.price} /></StatusPill>}
                          {job.negotiable && <StatusPill>Negotiable</StatusPill>}
                          {job.images.length > 0 && <StatusPill><ImageIcon aria-hidden="true" className="size-3" />{job.images.length} image{job.images.length === 1 ? '' : 's'}</StatusPill>}
                          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-brand-accent">Open <ArrowRight aria-hidden="true" className="size-3.5" /></span>
                        </div>
                      </div>
                      {job.images[0] && <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-24">
                        <Image src={job.images[0]} alt="" fill sizes="(min-width: 640px) 96px, 64px" className="object-cover" />
                      </div>}
                    </Link>
                  </li>
                ))}
              </HoverChaser>
              {requests.length > visibleCount && <Button type="button" variant="vegaNormalBtn" className="min-h-11" onClick={() => setVisibleCount(count => count + 50)}>Show more requests</Button>}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
