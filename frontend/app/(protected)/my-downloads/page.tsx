'use client';
/** @fileOverview Private download library with real transfer feedback and stable refreshes. @stability stable */
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import Link from '@/components/ui/navigation-link';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/use-current-user';
import { FiDownload, FiFile, FiRefreshCw } from 'react-icons/fi';

interface DownloadToken {
  id: string; token: string; maxUses: number; usedCount: number; expiresAt: string | null; isRevoked: boolean;
  digitalAsset: { id: string; fileName: string; fileSize: number; mimeType: string };
  order: { id: string; createdAt: string };
  product: { id: string; title: string; image: string[] } | null;
}
function statusLabel(file: DownloadToken) {
  if (file.isRevoked) return 'Revoked';
  if (file.expiresAt && Date.parse(file.expiresAt) <= Date.now()) return 'Expired';
  if (file.usedCount >= file.maxUses) return 'Limit reached';
  return 'Available';
}
function fileSize(bytes: number) {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}
export default function MyDownloadsPage() {
  const user = useCurrentUser();
  const [transfer, setTransfer] = useState<{ id: string; message: string; failed?: boolean } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const transferLock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ downloads: DownloadToken[] }>(
    user?.id ? ['/api/my-downloads', user.id] : null,
    async ([url]: [string, string]) => {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Please sign in again.' : 'Could not load your downloads. Please try again.');
      const result = await response.json();
      if (!Array.isArray(result.downloads)) throw new Error('Could not load your downloads. Please try again.');
      return result;
    }, { revalidateOnFocus: true, shouldRetryOnError: false },
  );
  const download = async (file: DownloadToken) => {
    if (transferLock.current || statusLabel(file) !== 'Available') return;
    transferLock.current = true; setPending(file.id); setTransfer(null);
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch('/api/download/' + encodeURIComponent(file.token), { cache: 'no-store', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(60_000)]) });
      if (!response.ok) {
        const message = response.status === 401 ? 'Please sign in again before downloading.' : response.status === 410 ? 'This download has expired or is no longer available.' : response.status === 403 ? 'This account cannot download this file.' : response.status === 429 ? 'Download limit reached. Check your remaining uses or try again later.' : 'The file could not be downloaded. Please try again.';
        throw new Error(message);
      }
      const blob = await response.blob();
      if (abort.signal.aborted) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = file.digitalAsset.fileName; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setTransfer({ id: file.id, message: 'File sent to your browser. Check your downloads.' });
    } catch (failure) {
      if (!abort.signal.aborted) setTransfer({ id: file.id, failed: true, message: failure instanceof Error && failure.name !== 'TimeoutError' ? failure.message : 'The download timed out. Check your downloads before trying again.' });
    } finally {
      transferLock.current = false; controller.current = null;
      if (!abort.signal.aborted) { setPending(null); void mutate(); }
    }
  };
  const loading = !user || isLoading;
  return <section aria-labelledby="downloads-title" className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><h1 id="downloads-title" className="text-2xl font-semibold tracking-tight">My downloads</h1><p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">Your private digital files. Stay signed in to download, and check each link’s expiry below.</p></div>
        <div className="flex w-full gap-2 sm:w-auto"><Button variant="outline" className="h-11 flex-1 gap-2 sm:flex-none" disabled={loading || isValidating || !!pending} onClick={() => void mutate()}><FiRefreshCw aria-hidden />{isValidating && !loading ? 'Refreshing…' : 'Refresh'}</Button><Button variant="outline" className="h-11 flex-1 sm:flex-none" asChild><Link href="/my-orders">My orders</Link></Button></div>
      </div>
      {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>{error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'The request timed out. Please try again.'}</p><Button variant="outline" className="mt-3 h-11" onClick={() => void mutate()}>Try again</Button></div>}
      {loading ? <div role="status" aria-label="Loading downloads" className="space-y-4">{[0, 1].map(i => <div key={i} className="min-h-80 rounded-xl border border-border p-4 sm:min-h-64 sm:p-5"><div className="flex gap-4"><span className="h-16 w-16 shrink-0 rounded-lg bg-muted motion-safe:animate-pulse" /><span className="h-5 w-1/2 rounded bg-muted motion-safe:animate-pulse" /></div><div className="mt-5 h-4 w-2/3 rounded bg-muted motion-safe:animate-pulse" /><div className="mt-4 h-16 w-full rounded bg-muted motion-safe:animate-pulse" /><div className="mt-5 h-11 w-full rounded bg-muted motion-safe:animate-pulse sm:w-36" /></div>)}</div>
        : data?.downloads.length ? <ul aria-label="Your downloads" className="space-y-4">{data.downloads.map(file => {
          const status = statusLabel(file), available = status === 'Available';
          return <li key={file.id} className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-20">{file.product?.image[0] ? <Image src={file.product.image[0]} alt="" fill sizes="(min-width: 640px) 80px, 64px" className="object-cover" /> : <FiFile aria-hidden className="m-auto mt-5 h-6 w-6 text-muted-foreground sm:mt-7" />}</div>
              <div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold leading-snug [overflow-wrap:anywhere]">{file.product?.title ?? file.digitalAsset.fileName}</h2><span className="mt-2 inline-flex rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium">{status}</span></div>
            </div>
            <p className="mt-4 break-words text-sm font-medium [overflow-wrap:anywhere]">{file.digitalAsset.fileName}<span className="ml-2 font-normal text-muted-foreground">({fileSize(file.digitalAsset.fileSize)})</span></p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Downloads remaining</dt><dd className="mt-1 tabular-nums">{file.maxUses >= 2_147_483_647 ? 'Unlimited' : Math.max(0, file.maxUses - file.usedCount)}</dd></div><div><dt className="text-muted-foreground">{file.expiresAt ? 'Link expires' : 'Access'}</dt><dd className="mt-1">{file.expiresAt ? new Date(file.expiresAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No expiry'}</dd></div></dl>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row"><Button className="h-11 gap-2" disabled={!available || !!pending} onClick={() => void download(file)}><FiDownload aria-hidden />{pending === file.id ? 'Downloading…' : 'Download file'}</Button><Button className="h-11" variant="outline" asChild><Link href={'/order-confirmation/' + encodeURIComponent(file.order.id)}>View receipt</Link></Button></div>
            {!available && <p className="mt-3 text-sm text-muted-foreground">{status === 'Expired' ? 'This time-limited link has expired. Contact the seller with your receipt for help.' : 'This link is not available. Open your receipt and contact the seller for help.'}</p>}
            {transfer?.id === file.id && <p role={transfer.failed ? 'alert' : 'status'} className={'mt-3 text-sm ' + (transfer.failed ? 'text-destructive' : 'text-muted-foreground')}>{transfer.message}</p>}
          </li>;
        })}</ul> : !error && <div className="rounded-2xl border border-dashed border-border p-8 text-center"><FiDownload aria-hidden className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><h2 className="text-lg font-semibold">No downloads yet</h2><p className="mt-2 text-sm text-muted-foreground">Digital files appear here after your order is fulfilled.</p><Button asChild className="mt-5 h-11"><Link href="/products">Browse products</Link></Button></div>}
      {data?.downloads.length === 100 && <p className="mt-4 text-xs text-muted-foreground">Showing your latest 100 download links. Older orders are available in My orders.</p>}
    </div>
  </section>;
}
