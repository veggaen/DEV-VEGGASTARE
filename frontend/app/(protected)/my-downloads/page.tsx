'use client';
/** @fileOverview Private download library with real transfer feedback and stable refreshes. @stability stable */
import useSWR from 'swr';
import Image from 'next/image';
import Link from '@/components/ui/navigation-link';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/use-current-user';
import { FiClock, FiDownload, FiFile, FiRefreshCw } from 'react-icons/fi';
import { usePrivateDownload } from '@/hooks/use-private-download';
import PrivateDownloadButton from '@/components/checkout/private-download-button';
import { PageHeader } from '@/components/uicustom/chrome/page-header';
import { HoverChaser } from '@/components/uicustom/chrome/hover-chaser';
import { StatusPill } from '@/components/uicustom/settings/settings-primitives';

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
const card = 'min-w-0 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-e1 backdrop-blur-xl sm:p-5';

export default function MyDownloadsPage() {
  const user = useCurrentUser();
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
  const { pending, transfer, download } = usePrivateDownload(() => { void mutate(); });
  const loading = !user || isLoading;
  return <section aria-labelledby="downloads-title" className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Purchases"
        titleId="downloads-title"
        title="My downloads"
        description="Your private digital files. Stay signed in to download, and check each link’s expiry below."
        actions={<><Button variant="vegaNormalBtn" className="h-11 flex-1 gap-2 sm:flex-none" disabled={loading || isValidating || !!pending} onClick={() => void mutate()}><FiRefreshCw aria-hidden className={isValidating && !loading ? 'motion-safe:animate-spin' : ''} />{isValidating && !loading ? 'Refreshing…' : 'Refresh'}</Button><Button variant="vegaNormalBtn" className="h-11 flex-1 sm:flex-none" asChild><Link href="/my-orders">My orders</Link></Button></>}
        className="mb-6"
      />
      {error && <div role="alert" className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>{error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'The request timed out. Please try again.'}</p><Button variant="vegaNormalBtn" className="mt-3 h-11" onClick={() => void mutate()}>Try again</Button></div>}
      {loading ? <div role="status" aria-label="Loading downloads" className="space-y-4">{[0, 1].map(i => <div key={i} className={`${card} min-h-80 sm:min-h-64 motion-safe:animate-pulse`} style={{ opacity: 1 - i * 0.3 }}><div className="flex gap-4"><span className="h-16 w-16 shrink-0 rounded-xl bg-muted" /><span className="h-5 w-1/2 rounded bg-muted" /></div><div className="mt-5 h-4 w-2/3 rounded bg-muted" /><div className="mt-4 h-16 w-full rounded bg-muted" /><div className="mt-5 h-11 w-full rounded bg-muted sm:w-36" /></div>)}</div>
        : data?.downloads.length ? <HoverChaser as="ul" aria-label="Your downloads" className="space-y-4" boxClassName="rounded-2xl">{data.downloads.map(file => {
          const status = statusLabel(file), available = status === 'Available';
          return <li key={file.id} data-chase className={card}>
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-20">{file.product?.image[0] ? <Image src={file.product.image[0]} alt="" fill sizes="(min-width: 640px) 80px, 64px" className="object-cover" /> : <FiFile aria-hidden className="m-auto mt-5 h-6 w-6 text-muted-foreground sm:mt-7" />}</div>
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-base font-semibold leading-snug [overflow-wrap:anywhere]">{file.product?.title ?? file.digitalAsset.fileName}</h2>
                <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{file.digitalAsset.fileName} <span className="tabular-nums">({fileSize(file.digitalAsset.fileSize)})</span></p>
                <StatusPill tone={available ? 'accent' : status === 'Revoked' ? 'danger' : 'warning'} className="mt-2">{status}</StatusPill>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 rounded-xl bg-foreground/[0.03] p-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Downloads remaining</dt><dd className="mt-0.5 font-medium tabular-nums">{file.maxUses >= 2_147_483_647 ? 'Unlimited' : Math.max(0, file.maxUses - file.usedCount)}</dd></div>
              <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><FiClock aria-hidden className="size-3" />{file.expiresAt ? 'Link expires' : 'Access'}</dt><dd className="mt-0.5 font-medium">{file.expiresAt ? new Date(file.expiresAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No expiry'}</dd></div>
            </dl>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row"><PrivateDownloadButton file={{ id: file.id, token: file.token, fileName: file.digitalAsset.fileName, usedCount: file.usedCount }} className="h-11 gap-2" disabled={!available || !!pending} onDownload={download}><FiDownload aria-hidden />{pending === file.id ? 'Downloading…' : 'Download file'}</PrivateDownloadButton><Button className="h-11" variant="vegaNormalBtn" asChild><Link href={'/order-confirmation/' + encodeURIComponent(file.order.id)}>View receipt</Link></Button></div>
            {!available && <p className="mt-3 text-sm text-muted-foreground">{status === 'Expired' ? 'This time-limited link has expired. Contact the seller with your receipt for help.' : 'This link is not available. Open your receipt and contact the seller for help.'}</p>}
            {transfer?.id === file.id && <p role={transfer.failed ? 'alert' : 'status'} className={'mt-3 text-sm ' + (transfer.failed ? 'text-destructive' : 'text-muted-foreground')}>{transfer.message}</p>}
          </li>;
        })}</HoverChaser> : !error && <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center"><FiDownload aria-hidden className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><h2 className="text-lg font-semibold">No downloads yet</h2><p className="mt-2 text-sm text-muted-foreground">Digital files appear here after your order is fulfilled.</p><Button asChild variant="vegaEmeraldBtn" className="mt-5 h-11"><Link href="/products">Browse products</Link></Button></div>}
      {data?.downloads.length === 100 && <p className="mt-4 text-xs text-muted-foreground">Showing your latest 100 download links. Older orders are available in My orders.</p>}
    </div>
  </section>;
}
