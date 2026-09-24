/** @fileOverview Server-priced digital checkout with explicit Sandbox/Live/demo states. @stability experimental */
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';
import { quoteShowcaseCart, paypalEnvironment } from '@/lib/payments/showcase-policy';
import PreferredMoney from '@/components/checkout/preferred-money';
import { CheckoutEditProvider, RemoveCheckoutItem, CheckoutCreditAmount } from '@/components/checkout/checkout-edit-context';
import { paypalConfigured } from '@/lib/payments/showcase-paypal';
import ReviewerCheckoutButton from '@/components/checkout/reviewer-checkout-button';
import CreditRefundNotice from '@/components/checkout/credit-refund-notice';
import { productPurchaseState, PRODUCT_PURCHASE_NOTICE } from '@/lib/product-purchase-state';
import { DAILY_PURCHASE_CAP_ORE } from '@/lib/ai-credit-purchase';

export default async function CheckoutPage({ searchParams }: { searchParams?: Promise<{ cancelled?: string | string[] }> }) {
  const cancelled = (await searchParams)?.cancelled === '1';
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/login?callbackUrl=%2Fcheckout');
  const demo = isDemoUserId(session.user.id);
  const cart = await dbPrisma.cart.findUnique({ where: { userId: session.user.id }, include: {
    CartItem: { include: { Product: { select: { id: true, title: true, image: true, productType: true, visibility: true, downloadsEnabled: true } } } },
  } });
  const unavailable = cart?.CartItem.filter(item => productPurchaseState(item.Product) !== 'AVAILABLE') ?? [];
  if (unavailable.length) return <section aria-label="Checkout availability" className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
    <h1 className="text-2xl font-semibold">Some items need attention</h1>
    <p className="mt-3 leading-6 text-muted-foreground">No payment has been started. Review these items before continuing with the available products.</p>
    <ul className="mt-6 divide-y divide-border rounded-xl border border-border px-4">
      {unavailable.map(item => <li key={item.id} className="py-4">
        <Link href={`/products/${encodeURIComponent(item.productId)}`} className="inline-flex min-h-11 items-center break-words font-medium underline underline-offset-4">{item.Product.title}</Link>
        <p className="text-sm text-muted-foreground">{PRODUCT_PURCHASE_NOTICE[productPurchaseState(item.Product) === 'BROWSE_ONLY' ? 'BROWSE_ONLY' : 'UNAVAILABLE'].title}</p>
      </li>)}
    </ul>
    <Link href="/cart" className="mt-4 inline-flex min-h-11 items-center font-medium underline underline-offset-4">Review your cart</Link>
  </section>;
  let quote;
  try { quote = quoteShowcaseCart(cart?.CartItem.map(item => ({ productId: item.productId, quantity: item.quantity, creditAmount: item.creditAmount })) ?? []); }
  catch {
    return <section className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold">Review your cart</h1>
      <p className="mt-4 text-muted-foreground">This checkout supports one Interview Pack and one Interviewer AI Credits pack per order. Other listings are currently browse-only.</p>
      <Link href="/cart" className="mt-6 inline-flex min-h-11 items-center underline">Return to cart</Link>
    </section>;
  }
  const mode = demo ? 'DEMO' : paypalEnvironment().mode;
  const available = demo || paypalConfigured();
  const purchasedCredits = quote.lines.reduce((sum, line) => sum + line.credits, 0);
  const creditAccount = !demo && purchasedCredits > 0 ? await dbPrisma.aiCreditAccount.findUnique({
    where: { id: `${mode}:${session.user.id}` }, select: { refundAdjustment: true },
  }) : null;
  return <CheckoutEditProvider><div data-checkout className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <Link href="/cart" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">Back to cart</Link>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Secure checkout</h1>
    <p className="mt-2 text-muted-foreground">One-time purchase · Digital delivery</p>
    {cancelled && <div role="status" className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-sm"><h2 className="font-semibold">Returned from PayPal</h2><p className="mt-1">Your cart is saved. Returning here does not confirm a payment or add credits. If you already approved payment, check <Link href="/my-orders" className="underline underline-offset-4">My orders</Link> before starting another checkout.</p></div>}
    <ReviewerCheckoutButton key={JSON.stringify(quote)} expectedQuote={JSON.stringify(quote)} demo={demo} disabled={!available}
      hasFiles={quote.lines.some(line => line.kind === 'DIGITAL_FILES')} hasCredits={purchasedCredits > 0} order={
      <section className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-label="Order items">
        <h2 className="text-lg font-semibold">Your order</h2>
        <div className="mt-4 divide-y divide-border">
          {quote.lines.map(line => <div key={line.productId} className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-x-4 gap-y-3 py-5 sm:grid-cols-[5rem_minmax(0,1fr)]">
            <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-20">
              <Image src={cart!.CartItem.find(item => item.productId === line.productId)!.Product.image[0]} alt="" fill sizes="(max-width: 639px) 64px, 80px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="break-words font-medium">{line.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{line.kind === 'DIGITAL_FILES' ? 'JPG + TXT · Private downloads' : 'Prepaid AI usage'}</p>
              <div className="mt-2 text-sm font-semibold"><PreferredMoney amount={line.amountOre / 100} /></div>
            </div>
            <div className="col-span-2 min-w-0">
              {line.credits > 0 && <CheckoutCreditAmount itemId={cart!.CartItem.find(item => item.productId === line.productId)!.id} value={line.credits} />}
              <RemoveCheckoutItem itemId={cart!.CartItem.find(item => item.productId === line.productId)!.id} title={line.title} />
            </div>
          </div>)}
        </div>
      </section>} summary={<>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{mode === 'DEMO' ? 'Free demonstration' : mode === 'SANDBOX' ? 'PayPal Sandbox — test money only' : 'PayPal Live — real payment'}</p>
        <div className="my-6 flex flex-wrap items-baseline justify-between gap-3"><h2 className="font-medium">{demo ? 'Due today' : 'Total'}</h2><strong className="max-w-full text-2xl tabular-nums"><PreferredMoney amount={demo ? 0 : quote.totalOre / 100} /></strong></div>
        {!demo && <p className="mb-4 text-sm text-muted-foreground">PayPal charge: <strong className="font-medium text-foreground">NOK {(quote.totalOre / 100).toFixed(2)}</strong>. Other currencies are estimates.</p>}
        {!available && <p role="status" className="mb-4 text-sm text-muted-foreground">PayPal setup is in progress. No payment can be taken yet. The free demo remains available.</p>}
        {(creditAccount?.refundAdjustment ?? 0) > 0 && <div className="mb-4"><CreditRefundNotice adjustment={creditAccount!.refundAdjustment} purchasedCredits={purchasedCredits} /></div>}
        {!demo && <details className="mb-4 text-xs text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-2">Purchase limits</summary><p className="pb-3 leading-relaxed">Two new checkout attempts and NOK {new Intl.NumberFormat('en').format(DAILY_PURCHASE_CAP_ORE / 100)} per account per UTC day, including pending attempts. Retrying an existing order does not create another charge.</p></details>}
      </>} />
  </div></CheckoutEditProvider>;
}
