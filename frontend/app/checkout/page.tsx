/** Authenticated checkout shell; selected-currency quotes are issued to the signed-in browser. */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';
import { paypalEnvironment } from '@/lib/payments/showcase-policy';
import { paypalConfigured } from '@/lib/payments/showcase-paypal';
import { productPurchaseState, PRODUCT_PURCHASE_NOTICE } from '@/lib/product-purchase-state';
import { isShowcaseProduct, SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { cartItemDto } from '@/lib/cart-credit-policy';
import { CartItemDtoSchema } from '@/lib/types/carts';
import CheckoutClient from '@/components/checkout/checkout-client';

export default async function CheckoutPage({ searchParams }: { searchParams?: Promise<{ cancelled?: string | string[] }> }) {
  const cancelled = (await searchParams)?.cancelled === '1';
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/login?callbackUrl=%2Fcheckout');
  const demo = isDemoUserId(session.user.id);
  const cart = await dbPrisma.cart.findUnique({ where: { userId: session.user.id }, include: {
    CartItem: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { Product: true } },
  } });
  const unavailable = cart?.CartItem.filter(item => productPurchaseState(item.Product) !== 'AVAILABLE') ?? [];
  if (unavailable.length) return <section aria-label="Checkout availability" className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
    <h1 className="text-2xl font-semibold">Some items need attention</h1>
    <p className="mt-3 leading-6 text-muted-foreground">No payment has been started. Review these items before continuing.</p>
    <ul className="mt-6 divide-y divide-border rounded-xl border border-border px-4">{unavailable.map(item => <li key={item.id} className="py-4">
      <Link href={`/products/${encodeURIComponent(item.productId)}`} className="inline-flex min-h-11 items-center break-words font-medium underline underline-offset-4">{item.Product.title}</Link>
      <p className="text-sm text-muted-foreground">{PRODUCT_PURCHASE_NOTICE[productPurchaseState(item.Product) === 'BROWSE_ONLY' ? 'BROWSE_ONLY' : 'UNAVAILABLE'].title}</p>
    </li>)}</ul>
    <Link href="/cart" className="mt-4 inline-flex min-h-11 items-center font-medium underline underline-offset-4">Review your cart</Link>
  </section>;
  if (!cart?.CartItem.length || cart.CartItem.some(item => !isShowcaseProduct(item.productId) || item.quantity !== 1)) return <section className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6">
    <h1 className="text-2xl font-semibold">Review your cart</h1>
    <p className="mt-4 text-muted-foreground">Choose Fjord Study or Veggat AI Credits, with one of each per order.</p>
    <Link href="/cart" className="mt-6 inline-flex min-h-11 items-center underline">Return to cart</Link>
  </section>;
  const mode = demo ? 'DEMO' : paypalEnvironment().mode;
  const creditAccount = !demo && cart.CartItem.some(item => item.productId === SHOWCASE_PRODUCTS.credits.id)
    ? await dbPrisma.aiCreditAccount.findUnique({ where: { id: `${mode}:${session.user.id}` }, select: { refundAdjustment: true } }) : null;
  return <CheckoutClient initialItems={cart.CartItem.map(item => CartItemDtoSchema.parse(cartItemDto(item)))} mode={mode}
    available={demo || paypalConfigured()} adjustment={creditAccount?.refundAdjustment ?? 0} cancelled={cancelled} />;
}
