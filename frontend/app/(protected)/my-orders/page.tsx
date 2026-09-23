'use client';
/** @fileOverview Private order history with truthful demo/paid receipts and stable refreshes. @stability stable */
import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import Link from '@/components/ui/navigation-link';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/use-current-user';
import { OrdersListResponseSchema, type OrderDto } from '@/lib/types/orders';
import { orderReceiptHref, orderStatusLabel } from '@/lib/order-presentation';
import PreferredMoney from '@/components/checkout/preferred-money';
import { FiChevronDown, FiDownload, FiPackage, FiRefreshCw } from 'react-icons/fi';

export default function MyOrdersPage() {
  const user = useCurrentUser();
  const query = useSearchParams();
  const expanded = query.get('order');
  const { data: orders, error, isLoading, isValidating, mutate } = useSWR<OrderDto[]>(
    user?.id ? ['/api/orders/user/' + encodeURIComponent(user.id), user.id] : null,
    async ([url]: [string, string]) => {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Please sign in again.' : 'Could not load your orders. Please try again.');
      return OrdersListResponseSchema.parse(await response.json());
    }, { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const toggle = (id: string) => {
    const params = new URLSearchParams(query);
    if (expanded === id) params.delete('order'); else params.set('order', id);
    window.history.pushState(null, '', '/my-orders' + (params.size ? '?' + params : ''));
  };
  const loading = !user || isLoading;
  return <section aria-labelledby="orders-title" className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><h1 id="orders-title" className="text-2xl font-semibold tracking-tight">My orders</h1><p className="mt-1 text-sm text-muted-foreground">Receipts, order details and your digital purchases.</p></div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="outline" className="h-11 flex-1 gap-2 sm:flex-none" disabled={loading || isValidating} onClick={() => void mutate()}><FiRefreshCw aria-hidden />{isValidating && !loading ? 'Refreshing…' : 'Refresh'}</Button>
          <Button variant="outline" asChild className="h-11 flex-1 gap-2 sm:flex-none"><Link href="/my-downloads"><FiDownload aria-hidden />Downloads</Link></Button>
        </div>
      </div>
      {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>{error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'The request timed out. Please try again.'}</p><Button variant="outline" className="mt-3 h-11" onClick={() => void mutate()}>Try again</Button></div>}
      {loading ? <div role="status" aria-label="Loading orders" className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="min-h-36 rounded-xl border border-border p-4 sm:min-h-28 sm:p-5"><div className="h-4 w-36 rounded bg-muted motion-safe:animate-pulse" /><div className="mt-3 h-3 w-44 rounded bg-muted motion-safe:animate-pulse" /><div className="mt-4 h-6 w-24 rounded bg-muted motion-safe:animate-pulse" /></div>)}</div>
        : orders?.length ? <ul aria-label="Your orders" className="space-y-3">{orders.map(order => {
          const open = expanded === order.id, demo = order.checkout?.environment === 'DEMO', sandbox = order.checkout?.environment === 'SANDBOX';
          return <li key={order.id} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
            <h2><button type="button" aria-expanded={open} aria-controls={'details-' + order.id} onClick={() => toggle(order.id)} className="flex w-full min-w-0 items-start justify-between gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted/40 sm:items-center sm:p-5">
              <span className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0"><span className="block text-sm font-semibold">Order #{order.id.slice(-8).toUpperCase()}</span><time dateTime={order.createdAt} className="mt-1 block text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time><span className="mt-3 inline-flex rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium">{orderStatusLabel(order)}</span></span>
                <span className="min-w-0 sm:text-right"><span className="block text-sm font-semibold tabular-nums"><PreferredMoney amount={demo ? 0 : order.totalAmount} currency={order.currency ?? null} /></span><span className="mt-1 block text-xs text-muted-foreground">{demo ? 'No payment collected' : sandbox ? 'Test amount · no real money' : 'Order total'}</span></span>
              </span><FiChevronDown aria-hidden className={'mt-1 h-5 w-5 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-150 ' + (open ? 'rotate-180' : '')} />
            </button></h2>
            {open && <div id={'details-' + order.id} className="space-y-4 border-t border-border p-4 sm:p-5">
              {(demo || sandbox) && <p className="text-sm leading-relaxed text-muted-foreground">{demo ? 'This is a free demonstration, not a paid order. The prices below show catalog value only. Demo checkout does not purchase additional AI credits.' : 'PayPal Sandbox is a test environment. No real money was collected.'}</p>}
              {!!order.items?.length && <ul aria-label="Order items" className="divide-y divide-border">{order.items.map(item => <li key={item.id} className="flex min-w-0 flex-wrap items-start justify-between gap-4 py-3 text-sm"><span className="min-w-0 break-words [overflow-wrap:anywhere]">{item.title}<span className="mt-1 block text-xs text-muted-foreground">Quantity {item.quantity}</span></span><span className="max-w-full tabular-nums"><PreferredMoney amount={item.priceAtTime * item.quantity} currency={order.currency ?? null} /></span></li>)}</ul>}
              <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Order status</dt><dd className="mt-1 font-medium">{orderStatusLabel(order)}</dd></div>{order.fulfilmentStatus && <div><dt className="text-muted-foreground">Delivery</dt><dd className="mt-1 capitalize">{order.fulfilmentStatus.toLowerCase().replaceAll('_', ' ')}</dd></div>}</dl>
              <div className="flex flex-col gap-2 sm:flex-row"><Button asChild variant="outline" className="h-11"><Link href={orderReceiptHref(order)}>View receipt</Link></Button><Button asChild variant="outline" className="h-11 gap-2"><Link href="/my-downloads"><FiDownload aria-hidden />View downloads</Link></Button></div>
            </div>}
          </li>;
        })}</ul> : !error && <div className="rounded-2xl border border-dashed border-border p-8 text-center"><FiPackage aria-hidden className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><h2 className="text-lg font-semibold">No orders yet</h2><p className="mt-2 text-sm text-muted-foreground">Your purchases and demo receipts will appear here.</p><Button asChild className="mt-5 h-11"><Link href="/products">Browse products</Link></Button></div>}
      {!!orders?.length && <p className="mt-4 text-xs text-muted-foreground">Showing {orders.length === 100 ? 'your latest 100 orders' : `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}.</p>}
    </div>
  </section>;
}
