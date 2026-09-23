"use client";

/** @fileOverview Accessible, responsive cart with row-isolated updates and original-currency totals. @stability stable */
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/cart-context";
import { useCartPage } from "@/hooks/use-cart-page";
import { cartCurrencyTotals } from "@/lib/cart-display";
import PreferredMoney from '@/components/checkout/preferred-money';
import { isShowcaseProduct } from "@/lib/showcase-catalog";
import CartSkeleton, { CartHeader, cartCanvas, cartColumns } from "@/components/checkout/cart-skeleton";

export default function CartPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { syncCart } = useCart();
  const { items, loading, error, needsRefresh, refreshing, pending, reload, mutate } = useCartPage(session?.user?.id, syncCart);
  const busy = pending.size > 0 || refreshing;
  const totals = cartCurrencyTotals(items);
  const supported = items.every(item => isShowcaseProduct(item.product.id));
  const validQuantities = items.every(item => item.quantity === 1);
  const canCheckout = !busy && !needsRefresh && !!totals && supported && validQuantities;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/login?callbackUrl=%2Fcart");
  }, [status, router]);

  if (loading || !session?.user) return <CartSkeleton />;

  return <div className={cartCanvas}>
    <CartHeader />
    <div className="sr-only" role="status" aria-live="polite">{busy ? "Updating your cart…" : `${items.reduce((sum, item) => sum + item.quantity, 0)} items in your cart.`}</div>
    {error && <div role="alert" className="my-5 rounded-xl border border-border bg-muted/50 p-4 text-sm leading-6">
      <p>{error}</p>
      {needsRefresh && <Button variant="outline" className="mt-3 min-h-11" disabled={busy} onClick={() => void reload()}>
        {refreshing ? "Refreshing cart…" : "Refresh saved cart"}
      </Button>}
    </div>}
    {items.length === 0 && !needsRefresh ? <section className="flex flex-col items-center px-4 py-16 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-muted"><ShoppingBag aria-hidden="true" className="size-7 text-muted-foreground" /></div>
      <h2 className="mt-6 text-xl font-semibold">Your cart is empty</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Explore digital products and AI credits in the marketplace.</p>
      <Button asChild className="mt-6 min-h-12"><Link href="/products">Browse products</Link></Button>
    </section> : items.length > 0 && <div className={cartColumns}>
      <section aria-label="Cart items" className="min-w-0">
        <ul className="divide-y divide-border">
          {items.map(item => {
            const isPending = pending.has(item.id);
            const disabled = isPending || needsRefresh || refreshing;
            const href = `/products/${encodeURIComponent(item.product.id)}`;
            return <li key={item.id} aria-busy={isPending} className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-4 py-6 sm:grid-cols-[6rem_minmax(0,1fr)]">
              <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block size-20 overflow-hidden rounded-xl border border-border bg-muted sm:size-24">
                {item.product.image[0] ? <Image src={item.product.image[0]} alt="" fill sizes="(min-width: 640px) 96px, 80px" className="object-cover" /> : <ShoppingBag className="m-auto h-full w-8 text-muted-foreground" />}
              </Link>
              <div className="min-w-0 py-1">
                <h2 className="text-base font-semibold leading-6 [overflow-wrap:anywhere]"><Link href={href} className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.product.title}</Link></h2>
                <div className="mt-2 text-sm tabular-nums text-muted-foreground"><PreferredMoney amount={item.product.price} currency={item.product.priceCurrency ?? 'USD'} /> <span className="text-xs">each</span></div>
              </div>
              <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 sm:col-span-1 sm:col-start-2">
                <div role="group" aria-label={`Quantity for ${item.product.title}`} className="flex shrink-0 items-center rounded-lg border border-border">
                  <Button size="icon" variant="ghost" className="size-11 rounded-r-none" onClick={() => void mutate(item.id, "decrement")} disabled={disabled || item.quantity <= 1} aria-label="Decrease quantity"><Minus aria-hidden="true" className="size-4" /></Button>
                  <span className="min-w-10 px-1 text-center text-sm font-medium tabular-nums" aria-live="polite">{item.quantity}</span>
                  <Button size="icon" variant="ghost" className="size-11 rounded-l-none" onClick={() => void mutate(item.id, "increment")} disabled={disabled || item.quantity >= 1000} aria-label="Increase quantity"><Plus aria-hidden="true" className="size-4" /></Button>
                </div>
                <Button variant="ghost" className="min-h-11 gap-2 px-3 text-sm text-muted-foreground hover:text-destructive" disabled={disabled} onClick={() => void mutate(item.id, "remove")}>
                  {isPending ? <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />}Remove
                </Button>
              </div>
            </li>;
          })}
        </ul>
        <Button asChild variant="ghost" className="mt-2 min-h-11 gap-2"><Link href="/products"><ArrowLeft aria-hidden="true" className="size-4" />Continue shopping</Link></Button>
      </section>
      <section aria-label="Cart summary" className="min-w-0 self-start rounded-2xl border border-border bg-surface-1 p-5 lg:sticky lg:top-6 lg:mt-6 lg:p-6">
        <h2 className="text-lg font-semibold">Summary</h2>
        <dl className="mt-5 space-y-4 text-sm">
          <div className="flex items-baseline justify-between gap-3"><dt className="text-muted-foreground">Items</dt><dd className="tabular-nums">{items.reduce((sum, item) => sum + item.quantity, 0)}</dd></div>
          {totals ? totals.map(total => <div key={total.currency} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-4">
            <dt className="font-medium">{totals.length > 1 ? `${total.currency} subtotal` : "Subtotal"}</dt><dd className="text-xl font-semibold tabular-nums"><PreferredMoney currency={total.currency} amount={items.filter(item => (item.product.priceCurrency ?? 'USD') === total.currency).reduce((sum, item) => sum + item.product.price * item.quantity, 0)} /></dd>
          </div>) : <div><dt>Subtotal</dt><dd>Price unavailable. Refresh your saved cart.</dd></div>}
        </dl>
        {!supported ? <p className="mt-4 text-sm leading-6 text-muted-foreground">Checkout is currently available for the Interview Pack and Interviewer AI Credits. Remove other listings to continue.</p>
          : !validQuantities && <p className="mt-4 text-sm leading-6 text-muted-foreground">Reviewer checkout supports one of each product. Set each quantity to 1 to continue.</p>}
        {canCheckout ? <Button asChild className="mt-5 min-h-12 w-full"><Link href="/checkout">Proceed to checkout</Link></Button>
          : <Button disabled className="mt-5 min-h-12 w-full">{busy ? "Updating cart…" : "Proceed to checkout"}</Button>}
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{session.user.isDemo
          ? "Demo checkout is free. No payment or card details are needed."
          : "Converted prices are estimates in your selected display currency. Checkout confirms the original-currency charge; your payment provider may use a different exchange rate."}</p>
      </section>
    </div>}
  </div>;
}
