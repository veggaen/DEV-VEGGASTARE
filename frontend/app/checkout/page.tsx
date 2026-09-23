/** @fileOverview Server-priced digital checkout with explicit Sandbox/Live/demo states. @stability experimental */
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';
import { quoteShowcaseCart, moneyString, paypalEnvironment } from '@/lib/payments/showcase-policy';
import { paypalConfigured } from '@/lib/payments/showcase-paypal';
import ReviewerCheckoutButton from '@/components/checkout/reviewer-checkout-button';

export default async function CheckoutPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/login?callbackUrl=%2Fcheckout');
  const demo = isDemoUserId(session.user.id);
  const cart = await dbPrisma.cart.findUnique({ where: { userId: session.user.id }, include: {
    CartItem: { include: { Product: { select: { image: true } } } },
  } });
  let quote;
  try { quote = quoteShowcaseCart(cart?.CartItem.map(item => ({ productId: item.productId, quantity: item.quantity })) ?? []); }
  catch {
    return <section className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold">Review your cart</h1>
      <p className="mt-4 text-muted-foreground">This checkout supports one Interview Pack and one Interviewer AI Credits pack per order. Other listings are currently browse-only.</p>
      <Link href="/cart" className="mt-6 inline-flex min-h-11 items-center underline">Return to cart</Link>
    </section>;
  }
  const mode = demo ? 'DEMO' : paypalEnvironment().mode;
  const available = demo || paypalConfigured();
  return <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <Link href="/cart" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">Back to cart</Link>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Secure checkout</h1>
    <p className="mt-3 max-w-2xl text-muted-foreground">Digital products from Veggat Studio. No shipping, no recurring charge. Your files and credits stay attached to your account.</p>
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="min-w-0 rounded-xl border bg-card p-5 sm:p-6" aria-label="Order items">
        <h2 className="text-lg font-semibold">Your order</h2>
        <div className="mt-4 divide-y">
          {quote.lines.map(line => <div key={line.productId} className="flex min-w-0 gap-4 py-5">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
              <Image src={cart!.CartItem.find(item => item.productId === line.productId)!.Product.image[0]} alt={line.title} fill sizes="80px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium">{line.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{line.kind === 'DIGITAL_FILES' ? 'Original JPG + interview notes TXT · private downloads' : '100 AI usage credits · no subscription'}</p>
              <p className="mt-2 text-sm font-semibold">{moneyString(line.amountOre)} NOK · Qty 1</p>
            </div>
          </div>)}
        </div>
      </section>
      <aside className="min-w-0 self-start rounded-xl border bg-card p-5 sm:p-6 lg:sticky lg:top-24">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{mode === 'DEMO' ? 'Free demonstration' : mode === 'SANDBOX' ? 'PayPal Sandbox — test money only' : 'PayPal Live — real payment'}</p>
        <div className="my-6 flex items-baseline justify-between gap-3"><h2 className="font-medium">{demo ? 'Due today' : 'Total'}</h2><strong className="text-2xl tabular-nums">{demo ? '0.00' : moneyString(quote.totalOre)} NOK</strong></div>
        <p className="mb-6 text-sm text-muted-foreground">{demo ? 'No card, no charge. Preview fulfillment with an isolated demo order.' : 'PayPal handles your payment details. We never receive your card number. Maximum two checkout attempts per day.'}</p>
        {!available && <p role="status" className="mb-4 text-sm text-muted-foreground">PayPal setup is in progress. No payment can be taken yet. The free demo remains available.</p>}
        <ReviewerCheckoutButton demo={demo} disabled={!available} />
        <p className="mt-4 text-xs text-muted-foreground">Downloads expire after 24 hours and require this account. <Link href="/terms" className="underline">Terms</Link> · <Link href="/privacy" className="underline">Privacy</Link></p>
      </aside>
    </div>
  </div>;
}
