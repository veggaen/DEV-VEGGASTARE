/** @fileOverview Auth-checked receipt; database capture state alone controls delivery. @stability experimental */
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { moneyString, type ShowcaseQuote } from '@/lib/payments/showcase-policy';
import CreditRefundNotice from '@/components/checkout/credit-refund-notice';
import ReceiptDownloads from '@/components/checkout/receipt-downloads';
import PreferredMoney from '@/components/checkout/preferred-money';
import { displayCreditPosition } from '@/lib/ai-credit-display';

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/auth/login?callbackUrl=${encodeURIComponent(`/checkout/receipt/${id}`)}`);
  const receipt = await dbPrisma.checkoutAttempt.findUnique({ where: { orderId: id }, include: { Order: { include: {
    OrderItem: true, DownloadToken: { where: { isRevoked: false, expiresAt: { gt: new Date() } }, include: { DigitalAsset: { select: { fileName: true } } } },
  } } } });
  if (!receipt || receipt.userId !== session.user.id) notFound();
  const environment = receipt.environment;
  if (environment !== 'DEMO' && environment !== 'LIVE' && environment !== 'SANDBOX') notFound();
  const demo = receipt.environment === 'DEMO', complete = receipt.state === 'COMPLETED', refunded = receipt.state === 'REFUNDED';
  const reversed = receipt.state === 'REVERSED', review = receipt.state === 'PAYMENT_REVIEW';
  const availableFiles = receipt.Order.DownloadToken.filter(file => file.usedCount < file.maxUses);
  const lines = (receipt.quote as unknown as ShowcaseQuote)?.lines ?? [];
  const purchasedCredits = lines.reduce((sum, line) => sum + line.credits, 0);
  const hasDigitalFiles = lines.some(line => line.kind === 'DIGITAL_FILES') || receipt.Order.DownloadToken.length > 0;
  const balance = await dbPrisma.aiCreditAccount.findUnique({ where: { id: `${receipt.environment}:${session.user.id}` }, select: { balance: true, refundAdjustment: true } });
  const display = displayCreditPosition(balance, environment);
  return <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{demo ? 'Demo · no payment collected' : receipt.environment === 'SANDBOX' ? 'Sandbox · no real money' : 'PayPal Live'}</p>
    <h1 className="mt-3 text-balance text-3xl font-semibold">{refunded ? 'Your order was refunded' : reversed ? 'Your payment was reversed' : review ? 'Your payment is under review' : complete ? demo ? 'Your demo order is ready' : 'Your order is confirmed' : 'Order awaiting confirmation'}</h1>
    <p className="mt-4 text-muted-foreground">{review ? 'A partial refund needs review. Downloads and credits from this order are unavailable until it is resolved. Your original receipt is retained below.' : refunded || reversed ? 'This receipt is retained for your records. Download access and credits from this order have been revoked.' : complete ? hasDigitalFiles ? 'Your files are ready below. Download without leaving your receipt, or find them later in My downloads.' : demo ? 'Your demo receipt is ready. Demo checkout does not add paid credits.' : 'Your credit purchase is verified. Open AI chat to use your available balance.' : 'No files or credits are released until payment is verified.'}</p>
    <dl className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 sm:p-6">
      <div><dt className="text-sm text-muted-foreground">{demo ? 'Charged' : 'Order total'}</dt><dd className="mt-1 text-xl font-semibold"><PreferredMoney amount={demo ? 0 : receipt.totalOre / 100} /></dd></div>
      <div className="min-w-0"><dt className="text-sm text-muted-foreground">Receipt ID</dt><dd className="mt-1 break-all font-mono text-sm">{receipt.captureId ?? receipt.orderId}</dd></div>
      <div><dt className="text-sm text-muted-foreground">AI credit balance</dt><dd data-testid="receipt-ai-credit-balance" className="mt-1 font-semibold">{display.available}{demo ? ' demo credits' : receipt.environment === 'SANDBOX' ? ' test credits' : ' credits'}</dd>
        {display.unclaimedDemoAllowance > 0 && <p className="mt-2 text-sm text-muted-foreground">Includes your free demo allowance, activated on your first supported message. This order did not buy credits.</p>}
      </div>
      <div><dt className="text-sm text-muted-foreground">Status</dt><dd className="mt-1">{receipt.state.toLowerCase().replaceAll('_', ' ')}</dd></div>
      {receipt.refundedOre > 0 && <div><dt className="text-sm text-muted-foreground">Verified refund amount</dt><dd className="mt-1 font-semibold"><PreferredMoney amount={receipt.refundedOre / 100} /></dd></div>}
      {receipt.refundReference && <div className="min-w-0"><dt className="text-sm text-muted-foreground">Payment adjustment reference</dt><dd className="mt-1 break-all font-mono text-sm">{receipt.refundReference}</dd></div>}
    </dl>
    {!demo && <details className="mt-3 text-sm text-muted-foreground"><summary className="flex min-h-11 cursor-pointer items-center underline underline-offset-4">Original payment details</summary><p>Recorded PayPal amount: {moneyString(receipt.totalOre)} NOK. Display conversions use current reference rates, not the rate on your bank statement.{receipt.refundedOre > 0 ? ` Recorded refund: ${moneyString(receipt.refundedOre)} NOK.` : ''}</p></details>}
    {(balance?.refundAdjustment ?? 0) > 0 && <div className="mt-6"><CreditRefundNotice adjustment={balance!.refundAdjustment} /></div>}
    {demo && <p className="mt-6 text-sm text-muted-foreground">Catalog value only: these items were not charged. Demo checkout does not purchase additional AI credits.</p>}
    {complete && !demo && purchasedCredits > 0 && <section aria-label="Credit purchase" className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">{purchasedCredits} {receipt.environment === 'SANDBOX' ? 'test credits' : 'credits'} purchased</h2><p className="mt-2 text-sm text-muted-foreground">{receipt.environment === 'SANDBOX' ? 'Test credits are separate from your live balance. ' : ''}Each model shows its fixed credit cost before you send. No subscription or automatic top-up.</p><Link href="/ai" className="mt-4 inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Use credits in AI chat</Link></section>}
    <ul aria-label="Receipt items" className="mt-6 divide-y divide-border rounded-xl border border-border bg-card px-5 sm:px-6">{receipt.Order.OrderItem.map(item => <li key={item.id} className="flex min-w-0 flex-wrap justify-between gap-4 py-4"><span className="min-w-0 break-words [overflow-wrap:anywhere]">{item.title} × {item.quantity}</span><span className="max-w-full tabular-nums"><PreferredMoney amount={Math.round(item.priceAtTime * item.quantity * 100) / 100} /></span></li>)}</ul>
    {complete && availableFiles.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold">Your downloads</h2><p className="mt-2 text-sm text-muted-foreground">Private links expire after 24 hours. Stay signed in to this account.</p><ReceiptDownloads files={availableFiles.map(file => ({ id: file.id, token: file.token, fileName: file.DigitalAsset.fileName }))} /></section>}
    <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">{hasDigitalFiles && <Link href="/my-downloads" className="inline-flex min-h-11 items-center underline">My downloads</Link>}<Link href="/my-orders" className="inline-flex min-h-11 items-center underline">My orders</Link><Link href="/ai" className="inline-flex min-h-11 items-center underline">Open AI chat</Link><Link href="/products" className="inline-flex min-h-11 items-center underline">Browse products</Link></div>
  </section>;
}
