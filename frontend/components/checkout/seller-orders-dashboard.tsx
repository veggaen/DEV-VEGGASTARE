"use client";
/** @fileOverview Responsive personal sales with abortable, single-request filter counts. @stability experimental */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ChevronDown, RefreshCw, ShoppingBag } from 'lucide-react';
import PriceAmount, { PriceTotal } from '@/components/crypto-related/PriceAmount';
import { SALE_FILTERS, SALE_LABELS, SellerOrderList, SellerOrdersQuery, safeShippingLink, type SellerOrderResponse, type SellerOrderRow } from '@/lib/payments/seller-orders';
import { SalesOrdersSkeleton, SalesRowsSkeleton } from './seller-orders-skeleton';

const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors duration-150 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const readable = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function SellerOrdersDashboard() {
  const search = useSearchParams();
  const parsed = SellerOrdersQuery.safeParse({ fulfilmentStatus: search.get('status') ?? 'ALL', page: search.get('page') ?? 1 });
  const { fulfilmentStatus: status, page } = parsed.success ? parsed.data : SellerOrdersQuery.parse({});
  const key = `${status}:${page}`;
  const expanded = search.get('order');
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; dataKey: string; data: SellerOrderResponse | null; error: string | null; loading: boolean }>({ key, dataKey: key, data: null, error: null, loading: true });
  const data = state.data;
  const current = state.dataKey === key;
  const loading = state.key !== key || state.loading;
  const error = state.key === key ? state.error : null;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setState(previous => ({ ...previous, key, error: null, loading: true }));
    void (async () => {
      try {
        const response = await fetch(`/api/seller/orders?fulfilmentStatus=${status}&page=${page}&limit=20`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired. Sign in again to view your sales.' : response.status === 429 ? 'Too many requests. Wait a moment, then try again.' : 'Your sales could not be loaded. Please try again.');
        const payload = SellerOrderList.safeParse(await response.json().catch(() => null));
        if (!payload.success || payload.data.pagination.page !== page || payload.data.counts[status] !== payload.data.pagination.total) throw new Error('The sales response was incomplete. Please try again.');
        if (active) setState({ key, dataKey: key, data: payload.data, loading: false, error: null });
      } catch (error) {
        if (active) setState(previous => ({ ...previous, loading: false, error: controller.signal.aborted ? 'The request took too long. Please try again.' : error instanceof Error ? error.message : 'Your sales could not be loaded. Please try again.' }));
      } finally { window.clearTimeout(timeout); }
    })();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [key, status, page, revision]);

  function navigate(nextStatus = status, nextPage = page, nextOrder: string | null = null) {
    const params = new URLSearchParams();
    if (nextStatus !== 'ALL') params.set('status', nextStatus);
    if (nextPage !== 1) params.set('page', String(nextPage));
    if (nextOrder) params.set('order', nextOrder);
    window.history.pushState(null, '', `/my-sales${params.size ? `?${params}` : ''}`);
  }
  return <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="space-y-4">
      <Link href="/nexus" className={`${control} w-fit`}><ArrowLeft aria-hidden="true" className="size-4" /> Business workspace</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Marketplace</p><h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight">My sales</h1><p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">Track orders containing your products. Payment and fulfilment are shown separately.</p></div>
        <button type="button" className={control} disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw aria-hidden="true" className={`size-4 ${loading ? 'motion-safe:animate-spin' : ''}`} />{loading ? 'Loading…' : 'Refresh sales'}</button>
      </div>
      <Link href="/my-sales/requests" className={`${control} w-full sm:w-auto`}>Review purchase requests <ArrowUpRight aria-hidden="true" className="size-4" /></Link>
    </header>
    {!parsed.success && <p role="status" className="rounded-lg border border-border p-4 text-sm">The saved filter was invalid. Showing all orders.</p>}
    {error && <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5"><p className="font-medium">Sales unavailable</p><p className="text-sm">{error}</p>{data && <p className="text-sm text-muted-foreground">{current ? 'Previously loaded orders remain below and may be out of date.' : 'Previous filter counts remain visible. Orders for the selected filter are unavailable.'}</p>}<div className="flex flex-wrap gap-3"><button type="button" className={control} disabled={loading} onClick={() => setRevision(value => value + 1)}>Try again</button><Link className={control} href="/auth/login?callbackUrl=%2Fmy-sales">Sign in</Link></div></div>}
    {!data && loading && <SalesOrdersSkeleton />}
    {data && <>
      {data.readOnly && <aside aria-label="Demo sales" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm leading-6">Demo workspace: real buyers’ sales and payment details are private. Explore your own unpaid purchases in <Link href="/my-orders" className="underline underline-offset-4 focus-visible:outline">My orders</Link>.</aside>}
      <dl className="grid gap-3 sm:grid-cols-3">
        <Metric title="Orders across all statuses"><span>{data.counts.ALL.toLocaleString()}</span></Metric>
        <Metric title="Displayed items value">{current ? <PriceTotal entries={data.orders.map(order => ({ amount: order.sellerTotal, currency: order.currency }))} /> : <span aria-label="Not available yet">—</span>}</Metric>
        <Metric title="Awaiting fulfilment"><span>{data.counts.UNFULFILLED.toLocaleString()}</span></Metric>
      </dl>
      <p className="text-xs leading-5 text-muted-foreground">Displayed value covers only the items shown on this page. It is not paid revenue, profit or a payout balance.</p>
      <div aria-label="Filter sales by fulfilment" role="group" className="flex flex-wrap gap-2">{SALE_FILTERS.map(filter => <button key={filter} type="button" aria-pressed={filter === status} className={`${control} ${filter === status ? 'border-foreground/40 bg-muted' : ''}`} onClick={() => navigate(filter, 1)}>{SALE_LABELS[filter]}<span className="rounded-md bg-muted px-1.5 text-xs tabular-nums">{data.counts[filter].toLocaleString()}</span></button>)}</div>
      <p aria-live="polite" className="text-sm text-muted-foreground">{loading ? `Loading ${SALE_LABELS[status].toLowerCase()}…` : !current ? 'Orders unavailable for this filter.' : `${data.pagination.total.toLocaleString()} ${data.pagination.total === 1 ? 'order' : 'orders'} · ${SALE_LABELS[status]}`}</p>
      <section aria-label="Sales orders" aria-busy={loading} className="space-y-3">
        {!current ? loading ? <SalesRowsSkeleton /> : null : data.orders.length === 0 ? <div className="rounded-xl border border-border bg-card p-6 text-center sm:p-10"><ShoppingBag aria-hidden="true" className="mx-auto mb-4 size-8 text-muted-foreground" /><h2 className="text-lg font-semibold">{page > 1 ? 'No orders on this page' : status === 'ALL' ? 'No sales yet' : 'No matching orders'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{data.readOnly ? 'Demo purchases are available in My orders; they do not create real seller revenue.' : status === 'ALL' ? 'Orders appear here when someone orders one of your products.' : 'Choose another fulfilment status or return to all orders.'}</p>{(page > 1 || status !== 'ALL') && <button className={`${control} mt-5`} onClick={() => navigate('ALL', 1)}>Show all orders</button>}</div> : data.orders.map(order => <OrderCard key={order.id} order={order} expanded={expanded === order.id} onToggle={() => navigate(status, page, expanded === order.id ? null : order.id)} />)}
      </section>
      {current && (data.pagination.totalPages > 1 || page > 1) && <nav aria-label="Sales pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"><button className={control} disabled={loading || page <= 1} onClick={() => navigate(status, page - 1)}>Previous page</button><span className="text-sm tabular-nums text-muted-foreground">Page {page} of {Math.max(1, data.pagination.totalPages)}</span><button className={control} disabled={loading || page >= data.pagination.totalPages} onClick={() => navigate(status, page + 1)}>Next page</button></nav>}
    </>}
  </div>;
}

function Metric({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="min-w-0 rounded-xl border border-border border-border bg-card p-4 sm:p-5"><dt className="text-sm text-muted-foreground">{title}</dt><dd className="mt-2 break-words text-xl font-semibold tabular-nums sm:mt-3 sm:text-2xl">{children}</dd></div>;
}

function OrderCard({ order, expanded, onToggle }: { order: SellerOrderRow; expanded: boolean; onToggle: () => void }) {
  const payment = order.payment;
  const trackingUrl = safeShippingLink(order.tracking?.url ?? null);
  const labelUrl = safeShippingLink(order.tracking?.labelUrl ?? null);
  const shortId = order.id.slice(-8).toUpperCase();
  return <article className="min-w-0 rounded-xl border border-border border-border bg-card">
    <h2><button type="button" aria-expanded={expanded} aria-controls={`sale-${order.id}`} aria-label={`Order ${shortId} details`} onClick={onToggle} className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-xl p-4 text-left transition-colors duration-150 hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-5">
      <span className="grid min-w-0 gap-3 sm:grid-cols-2 sm:items-center"><span className="min-w-0"><span className="block text-sm font-semibold">#{shortId}</span><time dateTime={order.createdAt} className="mt-1 block text-xs font-normal text-muted-foreground">{date(order.createdAt)}</time></span><span className="w-fit rounded-md border border-border px-2 py-1 text-xs font-normal">{SALE_LABELS[order.fulfilmentStatus]}</span><span className="text-base font-semibold sm:col-span-2"><PriceAmount amount={order.sellerTotal} currency={order.currency} /></span></span>
      <ChevronDown aria-hidden="true" className={`mt-1 size-5 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} />
    </button></h2>
    {expanded && <div id={`sale-${order.id}`} className="space-y-6 border-t border-border border-border p-4 sm:p-5">
      <div className="grid min-w-0 gap-6 lg:grid-cols-2"><section className="min-w-0"><h3 className="text-sm font-semibold">Customer</h3><p className="mt-2 break-words text-sm">{order.customer.name || 'Customer'}</p>{order.customer.email && <p className="mt-1 break-all text-sm text-muted-foreground">{order.customer.email}</p>}</section><section className="min-w-0"><h3 className="text-sm font-semibold">Payment status</h3><p className="mt-2 text-sm">{payment ? readable(payment.state ?? payment.status) : readable(order.status)}</p>{payment && <p className="mt-1 text-sm text-muted-foreground">{readable(payment.method)}{payment.environment ? ` · ${payment.environment}` : ''}</p>}<p className="mt-2 text-xs leading-5 text-muted-foreground">Fulfilment does not prove payment. A request approval does not issue a refund.</p></section></div>
      {order.sharedOrder && <p className="rounded-lg bg-muted/40 p-3 text-sm leading-6">Only your displayed items are included. Whole-order payment and tracking details are hidden when other or additional lines are present.</p>}
      <section><h3 className="text-sm font-semibold">Your items</h3><ul className="mt-2 divide-y divide-border">{order.items.map(item => <li key={item.id} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><p className="break-words text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.quantity} × {readable(item.productType)}</p></div><span className="text-sm"><PriceAmount amount={item.priceAtTime * item.quantity} currency={order.currency} /></span></li>)}</ul>{order.items.length === 50 && <p className="text-xs text-muted-foreground">Showing the first 50 matching lines. Contact support for larger historical orders.</p>}</section>
      {order.shipping?.address && <section><h3 className="text-sm font-semibold">Delivery address</h3><address className="mt-2 break-words text-sm not-italic leading-6">{order.shipping.name}<br />{order.shipping.address}<br />{order.shipping.postalCode} {order.shipping.city}<br />{order.shipping.country}</address></section>}
      {order.tracking?.number && <section><h3 className="text-sm font-semibold">Shipment</h3><p className="mt-2 break-all text-sm">{order.tracking.number}</p><div className="mt-3 flex flex-wrap gap-3">{trackingUrl && <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className={control}>Track shipment <span className="sr-only">(opens a new tab)</span></a>}{labelUrl && <a href={labelUrl} target="_blank" rel="noopener noreferrer" className={control}>Shipping label <span className="sr-only">(opens a new tab)</span></a>}</div></section>}
      {payment && <section><h3 className="text-sm font-semibold">Payment details</h3><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">{[
        ['Recipient', payment.receiver], ['Sender', payment.sender], ['Payment reference', payment.reference],
        ['Network', payment.chainFamily ? `${payment.chainFamily}${payment.chainId ? ` · ${payment.chainId}` : ''}` : null],
        ['Crypto paid', payment.nativeAmount && payment.tokenSymbol ? `${payment.nativeAmount} ${payment.tokenSymbol}` : null],
      ].filter(([, value]) => value).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-mono text-xs leading-5">{value}</dd></div>)}</dl></section>}
    </div>}
  </article>;
}
