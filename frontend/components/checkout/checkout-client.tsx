'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/contexts/cart-context';
import type { CartItemDto } from '@/lib/types/carts';
import { useCartSettlement } from '@/hooks/use-cart-settlement';
import PriceAmount from '@/components/crypto-related/PriceAmount';
import { Button } from '@/components/ui/button';
import { CheckoutEditProvider, CheckoutCreditAmount, RemoveCheckoutItem, useCheckoutEditing } from './checkout-edit-context';
import ReviewerCheckoutButton from './reviewer-checkout-button';
import CreditRefundNotice from './credit-refund-notice';

type Props = { initialItems: CartItemDto[]; mode: 'DEMO' | 'LIVE' | 'SANDBOX'; available: boolean; adjustment: number; cancelled: boolean };
export default function CheckoutClient(props: Props) {
  return <CheckoutEditProvider><CheckoutContents {...props} /></CheckoutEditProvider>;
}
function CheckoutContents({ initialItems, mode, available, adjustment, cancelled }: Props) {
  const { checkoutBlocked } = useCart(), editing = useCheckoutEditing();
  // The existing edit provider refreshes this server-owned snapshot after saves.
  const rows = initialItems;
  const pricing = useCartSettlement(rows, editing?.paymentPending);
  const { quote } = pricing, demo = mode === 'DEMO';
  const credits = quote?.lines.reduce((sum, line) => sum + line.credits, 0);
  const money = (minor: number) => quote && <PriceAmount amount={minor / 100} currency={quote.currency} displayFiat={quote.currency} context="settlement" />;
  return <div data-checkout className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <Link href="/cart" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">Back to cart</Link>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Secure checkout</h1>
    <p className="mt-2 text-muted-foreground">One-time purchase · Digital delivery</p>
    {cancelled && <p role="status" className="mt-5 rounded-xl border border-border bg-muted/30 p-4 text-sm">Your basket is saved. Already approved payment? Check <Link href="/my-orders" className="underline">My orders</Link> before starting another checkout.</p>}
    <ReviewerCheckoutButton demo={demo} quoteToken={pricing.token} disabled={!available || !pricing.ready || checkoutBlocked}
      hasFiles={rows.some(row => row.creditAmount === undefined)} hasCredits={rows.some(row => row.creditAmount !== undefined)}
      order={<section className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-label="Order items">
        <h2 className="text-lg font-semibold">Your order</h2>
        <div className="mt-3 divide-y divide-border">{rows.map(item => {
          const line = quote?.lines.find(line => line.productId === item.product.id);
          return <div key={item.id} className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-x-4 gap-y-3 py-4 sm:grid-cols-[5rem_minmax(0,1fr)]">
            <div className="relative size-16 overflow-hidden rounded-lg bg-muted sm:size-20">{item.product.image[0] && <Image src={item.product.image[0]} alt="" fill sizes="(max-width:639px) 64px,80px" className="object-cover" />}</div>
            <div className="min-w-0"><h3 className="break-words font-medium">{item.product.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.creditAmount === undefined ? 'JPG + TXT · Private downloads' : 'Prepaid AI usage'}</p>
              <div className="mt-2 text-sm font-semibold">{line ? money(line.amountMinor) : <span className="text-muted-foreground">Confirming price…</span>}</div>
            </div>
            <div className="col-span-2 min-w-0">{item.creditAmount !== undefined && <CheckoutCreditAmount item={item} />}
              <RemoveCheckoutItem itemId={item.id} title={item.product.title} /></div>
          </div>;
        })}</div>
      </section>}
      summary={<>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{demo ? 'Free demonstration' : mode === 'SANDBOX' ? 'PayPal Sandbox · Test money' : 'PayPal Live'}</p>
        <div className="my-6 flex flex-wrap items-baseline justify-between gap-3"><h2 className="font-medium">{demo ? 'Due today' : 'Total'}</h2>
          <strong data-checkout-total className="max-w-full text-2xl tabular-nums">{quote ? money(demo ? 0 : quote.totalMinor) : '—'}</strong></div>
        {quote && !demo && <p className="mb-4 text-xs text-muted-foreground">Charged in {quote.currency}. Crypto is a display estimate.</p>}
        {pricing.error && <div className="mb-4"><p role="alert" className="text-sm text-destructive">{pricing.error}</p>
          {pricing.needsCartRefresh ? <Link href="/cart" className="mt-2 inline-flex min-h-11 items-center text-sm underline">Review saved basket</Link>
            : <Button type="button" variant="outline" className="mt-2 min-h-11" disabled={editing?.busy || checkoutBlocked} onClick={pricing.refresh}>Refresh price</Button>}</div>}
        {pricing.loading && <p role="status" className="mb-4 text-sm text-muted-foreground">Confirming total…</p>}
        {!available && <p role="status" className="mb-4 text-sm text-muted-foreground">PayPal is unavailable. No payment can be taken.</p>}
        {adjustment > 0 && <div className="mb-4"><CreditRefundNotice adjustment={adjustment} purchasedCredits={credits} /></div>}
      </>} />
  </div>;
}
