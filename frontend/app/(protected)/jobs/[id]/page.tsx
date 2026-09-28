'use client';
/** @fileOverview Responsive experimental request detail with explicit read/retry states. @stability experimental */

import { useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PriceAmount from '@/components/crypto-related/PriceAmount';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { formatRequestDate, isRequestImage, isRequestUrl, readJobRequest } from '@/lib/job-request-detail';

const card = 'min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6';

function RequestFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <Button asChild variant="ghost" className="min-h-11"><Link href="/jobs"><ArrowLeft aria-hidden="true" className="size-4" />Back to requests</Link></Button>
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Experimental · Job board</p>
    {children}
  </div>;
}

function DetailSkeleton() {
  return <div role="status" aria-label="Loading request" className="space-y-6">
    <span className="sr-only">Loading request…</span>
    <div aria-hidden="true" className="space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-10 w-3/4" /></div>
    <div aria-hidden="true" className="grid min-w-0 gap-6 lg:grid-cols-5">
      <div className="min-w-0 space-y-4 lg:col-span-3"><Skeleton className="aspect-video w-full rounded-2xl" /><Skeleton className="h-28 w-full" /></div>
      <Skeleton className="h-52 w-full rounded-2xl lg:col-span-2" />
    </div>
  </div>;
}

export default function JobDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { user, isLoading } = useCurrentUserWithStatus();
  if (isLoading) return <RequestFrame><DetailSkeleton /></RequestFrame>;
  if (!user?.id || !id) return <RequestFrame><section className={card}>
    <h1 className="text-2xl font-semibold">Request unavailable</h1>
    <p className="mt-3 text-muted-foreground">Sign in to view requests shared with your account.</p>
    <Button asChild className="mt-4 min-h-11"><Link href={`/auth/login?callbackUrl=${encodeURIComponent(`/jobs/${id}`)}`}>Sign in</Link></Button>
  </section></RequestFrame>;
  // Identity and route changes reset the gallery. Each response is scoped to
  // its account/request key, so a late response cannot render another request.
  return <RequestDetail key={`${user.id}:${id}`} id={id} userId={user.id} />;
}

function RequestDetail({ id, userId }: { id: string; userId: string }) {
  const { data: read, error, isLoading, isValidating, mutate } = useSWR(
    [`/api/job-requests/${encodeURIComponent(id)}`, userId, id] as const, readJobRequest,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const [chosenImage, setChosenImage] = useState<string | null>(null);
  const request = read?.data;
  const problem = read?.problem;
  if (isLoading && !read) return <RequestFrame><DetailSkeleton /></RequestFrame>;
  if (!request) return <RequestFrame><section role="alert" className={`${card} space-y-4`}>
    <h1 className="text-2xl font-semibold">{error ? 'Could not load request' : problem?.kind === 'missing' ? 'Request not found' : 'Request unavailable'}</h1>
    <p className="text-muted-foreground">{error instanceof Error ? error.message : problem?.message || 'Please try again.'}</p>
    <Button type="button" variant="outline" className="min-h-11" disabled={isValidating} onClick={() => void mutate()}>Try again</Button>
  </section></RequestFrame>;

  const images = request.images.filter(isRequestImage);
  const selectedImage = chosenImage && images.includes(chosenImage) ? chosenImage : images[0];
  const links = request.links.filter(isRequestUrl);
  const docs = request.docs.filter(isRequestUrl);
  const title = request.title || `Request #${request.id.slice(0, 8)}`;

  return <RequestFrame>
    {error && <section role="alert" className={`${card} space-y-3 border-destructive/40`}>
      <h2 className="font-semibold">Could not refresh request</h2>
      <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Please try again.'} Your last loaded request is still shown below.</p>
      <Button type="button" variant="outline" className="min-h-11" disabled={isValidating} onClick={() => void mutate()}>Try again</Button>
    </section>}
    <header className="min-w-0 space-y-4">
      <div className="flex min-w-0 items-center gap-3">
        {request.user.image && isRequestImage(request.user.image) && <Image src={request.user.image} alt="" width={48} height={48} className="size-12 shrink-0 rounded-full object-cover" />}
        <div className="min-w-0"><p className="font-medium [overflow-wrap:anywhere]">{request.user.name || 'Member'}</p><p className="text-sm text-muted-foreground">{formatRequestDate(request.createdAt)}</p></div>
      </div>
      <h1 className="text-balance text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl lg:text-4xl">{title}</h1>
      <Button type="button" variant="outline" className="min-h-11" disabled={isValidating} onClick={() => void mutate()}>
        <RefreshCw aria-hidden="true" className={`size-4 ${isValidating ? 'animate-spin motion-reduce:animate-none' : ''}`} />{isValidating ? 'Refreshing…' : 'Refresh request'}
      </Button>
    </header>
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-5">
      <div className="min-w-0 space-y-6 lg:col-span-3">
        {selectedImage && <section aria-label="Request gallery" className="min-w-0 space-y-3">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-muted">
            <Image src={selectedImage} alt={`${title} — selected image`} fill sizes="(min-width: 1024px) 640px, 100vw" className="object-contain" />
          </div>
          {images.length > 1 && <div className="flex gap-3 overflow-x-auto overscroll-x-contain p-1">
            {images.map((src, index) => <button key={`${src}:${index}`} type="button" aria-label={`Show image ${index + 1}`} aria-pressed={selectedImage === src}
              onClick={() => setChosenImage(src)} className={`relative size-16 shrink-0 overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selectedImage === src ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:opacity-80'}`}>
              <Image src={src} alt="" fill sizes="64px" className="object-cover" />
            </button>)}
          </div>}
        </section>}
        <section className={`${card} space-y-4`}><h2 className="text-lg font-semibold">Description</h2>
          {request.descriptions.length ? request.descriptions.map((description, index) => <p key={index} className="whitespace-pre-wrap text-muted-foreground leading-relaxed [overflow-wrap:anywhere]">{description}</p>) : <p className="text-muted-foreground">No description provided.</p>}
        </section>
        {request.additionalNotes && <section className={`${card} space-y-3`}><h2 className="text-lg font-semibold">Additional notes</h2><p className="whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">{request.additionalNotes}</p></section>}
      </div>
      <aside aria-label="Request information" className="min-w-0 space-y-6 lg:col-span-2">
        <section className={`${card} space-y-4`}><h2 className="text-lg font-semibold">Interested in this request?</h2>
          <p className="text-sm text-muted-foreground">View the requester’s profile to see their details and available contact options. This experimental board does not process project payments.</p>
          <Button asChild className="min-h-11 w-full"><Link href={`/profile/${encodeURIComponent(request.user.id)}`}>View requester profile</Link></Button>
        </section>
        <section className={`${card} space-y-4`}><h2 className="text-lg font-semibold">Request details</h2>
          <dl className="space-y-4 text-sm">
            <div><dt className="text-muted-foreground">Budget</dt><dd className="mt-1">{request.price !== null ? <PriceAmount usd={request.price} /> : 'Not specified'}{request.negotiable && <span className="ml-2 text-muted-foreground">· Negotiable</span>}</dd></div>
            {request.delivery && <div><dt className="text-muted-foreground">Delivery</dt><dd className="mt-1 [overflow-wrap:anywhere]">{request.delivery}</dd></div>}
            {request.paymentMethod && <div><dt className="text-muted-foreground">Requested payment method</dt><dd className="mt-1 [overflow-wrap:anywhere]">{request.paymentMethod}</dd></div>}
          </dl>
        </section>
        {links.length > 0 && <section className={`${card} space-y-3`}><h2 className="text-lg font-semibold">Reference links</h2>
          {links.map((href, index) => <a key={`${href}:${index}`} href={href} target="_blank" rel="noopener noreferrer" className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{href}<span className="sr-only"> (opens in a new tab)</span></span>
          </a>)}
        </section>}
        {docs.length > 0 && <section className={`${card} space-y-3`}><h2 className="text-lg font-semibold">Documents</h2>
          {docs.map((href, index) => <a key={`${href}:${index}`} href={href} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm hover:underline focus-visible:outline-2 focus-visible:outline-ring"><FileText aria-hidden="true" className="size-4" />Document {index + 1}<span className="sr-only"> (opens in a new tab)</span></a>)}
        </section>}
      </aside>
    </div>
  </RequestFrame>;
}
