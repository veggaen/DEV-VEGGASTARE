/** @fileOverview Auth-checked receipt; database capture state alone controls delivery. @stability experimental */
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Check, Clock3, CircleAlert, ArrowUpRight, Download, Sparkles } from 'lucide-react';
import { moneyString, type ShowcaseQuote } from '@/lib/payments/showcase-policy';
import CreditRefundNotice from '@/components/checkout/credit-refund-notice';
import ReceiptDownloads from '@/components/checkout/receipt-downloads';
import PreferredMoney from '@/components/checkout/preferred-money';
import HistoricalPriceNote from '@/components/checkout/historical-price-note';
import { displayCreditPosition } from '@/lib/ai-credit-display';
import { storedCheckoutAgreement } from '@/lib/payments/checkout-agreement';
import PurchaseSupport from '@/components/checkout/purchase-support';
import { emailStatusText } from '@/lib/payments/email-policy';

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/auth/login?callbackUrl=${encodeURIComponent(`/checkout/receipt/${id}`)}`);
  const receipt = await dbPrisma.checkoutAttempt.findUnique({ where: { orderId: id }, include: { Order: { include: {
    OrderItem: true, ReturnRequest: { orderBy: { createdAt: 'desc' }, take: 20 },
    DownloadToken: { where: { isRevoked: false, expiresAt: { gt: new Date() } }, include: { DigitalAsset: { select: { fileName: true } } } },
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
  const agreement = storedCheckoutAgreement(receipt.quote);
  const emails = demo ? [] : await dbPrisma.transactionalEmail.findMany({ where: { orderId: id, userId: session.user.id,
    sourceKey: { in: [`purchase:${id}`, ...receipt.Order.ReturnRequest.map(request => `buyer-request:${request.id}`)] } },
    select: { sourceKey: true, status: true }, take: 25 });
  const sandbox = environment === 'SANDBOX', cancelled = receipt.state === 'CANCELLED';
  const confirmationReady = agreement && receipt.completedAt && (demo || receipt.captureId);
  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4';
  const StatusIcon = complete ? Check : refunded || reversed || review ? CircleAlert : Clock3;
  return <section aria-labelledby="receipt-title" data-receipt className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <header className="mb-6 flex items-start gap-4">
      <span className={`mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border ${complete ? 'border-primary/25 bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground'}`}><StatusIcon aria-hidden className="size-5" /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{demo ? 'Demo · no payment collected' : sandbox ? 'Sandbox · no real money' : 'PayPal Live'}</p>
        <h1 id="receipt-title" className="mt-1 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{refunded ? 'Your order was refunded' : reversed ? 'Your payment was reversed' : review ? 'Your payment is under review' : cancelled ? 'Your order is cancelled' : complete ? demo ? 'Your demo order is ready' : 'Your order is confirmed' : 'Order awaiting confirmation'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{review ? 'Delivery is paused while the payment adjustment is reviewed.' : refunded || reversed ? 'Access from this purchase has been revoked. Your original record is retained.' : cancelled ? 'This order will not start a new payment.' : complete ? demo ? 'Explore the purchase flow. No card was charged.' : 'Payment verified. Your purchase is ready.' : 'Delivery starts after payment is verified.'}</p>
      </div>
    </header>
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)] lg:gap-6">
      <div className="min-w-0 space-y-5" data-receipt-purchase>
        {complete && !demo && purchasedCredits > 0 && <section aria-label="Credit purchase" className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">Ready to use</p><h2 className="mt-1 text-xl font-semibold">{purchasedCredits} {sandbox ? 'test credits' : 'credits'} purchased</h2></div><Sparkles aria-hidden className="size-5 shrink-0 text-primary" /></div>
          <p className="mt-2 text-sm text-muted-foreground">{sandbox ? 'Test credits are separate from your live balance. ' : ''}No subscription or automatic top-up.</p>
          <Link href="/ai" className={`mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground [@media(hover:hover)]:hover:bg-primary/90 sm:w-auto ${focus}`}>Use credits in AI chat<ArrowUpRight aria-hidden className="size-4" /></Link>
        </section>}
        {complete && availableFiles.length > 0 && <section aria-label="Your downloads" className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Your downloads</h2><p className="mt-1 text-sm text-muted-foreground">Private links · 24 hours · Sign-in required</p><ReceiptDownloads files={availableFiles.map(file => ({ id: file.id, token: file.token, fileName: file.DigitalAsset.fileName }))} /></section>}
        <section aria-label="Order items" className="rounded-2xl border border-border bg-card px-5 sm:px-6">
          <h2 className="pt-5 text-sm font-semibold sm:pt-6">Your purchase</h2>
          <ul aria-label="Receipt items" className="divide-y divide-border">{receipt.Order.OrderItem.map(item => <li key={item.id} className="grid min-w-0 gap-x-4 gap-y-2 py-4 text-sm sm:flex sm:flex-wrap sm:justify-between"><span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{item.title}<span className="mt-1 block text-xs text-muted-foreground">Quantity {item.quantity}</span></span><span className="max-w-full font-medium tabular-nums"><PreferredMoney context="history" amount={Math.round(item.priceAtTime * item.quantity * 100) / 100} /></span></li>)}</ul>
          {demo && <p className="pb-5 text-xs text-muted-foreground">Catalog value only. Demo checkout does not purchase additional AI credits.</p>}
        </section>
        {(balance?.refundAdjustment ?? 0) > 0 && <CreditRefundNotice adjustment={balance!.refundAdjustment} />}
      </div>
      <aside aria-label="Payment details" className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-sm text-muted-foreground">{demo ? 'Charged' : complete ? 'Paid' : 'Order total'}</h2><strong className="max-w-full text-2xl tabular-nums"><PreferredMoney context="history" amount={demo ? 0 : receipt.totalOre / 100} /></strong></div>
        <dl className="mt-5 space-y-4 border-t border-border pt-5 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">AI credit balance</dt><dd data-testid="receipt-ai-credit-balance" className="font-medium tabular-nums">{display.available}{demo ? ' demo credits' : sandbox ? ' test credits' : ' credits'}</dd></div>
          <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Status</dt><dd className="capitalize">{receipt.state.toLowerCase().replaceAll('_', ' ')}</dd></div>
          <div><dt className="text-muted-foreground">Receipt ID</dt><dd className="mt-1 break-all font-mono text-xs">{receipt.captureId ?? receipt.orderId}</dd></div>
          {receipt.refundedOre > 0 && <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Verified refund amount</dt><dd className="font-medium"><PreferredMoney context="history" amount={receipt.refundedOre / 100} /></dd></div>}
          {receipt.refundReference && <div><dt className="text-muted-foreground">Payment adjustment reference</dt><dd className="mt-1 break-all font-mono text-xs">{receipt.refundReference}</dd></div>}
        </dl>
        {confirmationReady && <a href={`/api/checkout/${encodeURIComponent(receipt.orderId)}/confirmation`} download className={`mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-center text-sm font-medium [@media(hover:hover)]:hover:bg-muted ${focus}`}><Download aria-hidden className="size-4 shrink-0" />Download order confirmation (.txt)</a>}
        <details className="mt-3 text-sm text-muted-foreground">
          <summary className={`min-h-11 cursor-pointer py-3 underline underline-offset-4 ${focus}`}>Original payment details</summary>
          <div className="space-y-3 pb-1 text-xs leading-relaxed">
            <p>{demo ? 'Recorded catalog value (not charged)' : 'Recorded PayPal amount'}: {moneyString(receipt.totalOre)} NOK.{receipt.refundedOre > 0 ? ` Recorded refund: ${moneyString(receipt.refundedOre)} NOK.` : ''}</p>
            <HistoricalPriceNote />
            {display.unclaimedDemoAllowance > 0 && <p>Your free demo allowance activates on your first supported message. This order did not buy credits.</p>}
          </div>
        </details>
        {confirmationReady && <details aria-label="Original order confirmation" className="text-sm text-muted-foreground">
          <summary className={`min-h-11 cursor-pointer py-3 underline underline-offset-4 ${focus}`}>Terms & delivery record</summary>
          <div className="space-y-3 pb-1 text-xs leading-relaxed"><p>Your downloadable confirmation preserves the original order, delivery requests and purchase terms.</p>
            <p>{agreement.publishedTerms ? `Includes the full Norwegian sales terms, version ${agreement.publishedTerms.version}, and an optional withdrawal form.` : 'The terms retained at checkout are preserved; newer terms have not been added.'}</p>
            <p>{demo ? 'Demo records are download-only; no email is sent.' : emailStatusText(emails.find(email => email.sourceKey === `purchase:${id}`)?.status)}</p>
          </div>
        </details>}
      </aside>
    </div>
    <details data-receipt-support open={receipt.Order.ReturnRequest.length > 0} className="mt-5 rounded-xl border border-border bg-card px-5 sm:px-6">
      <summary className={`min-h-12 cursor-pointer py-4 text-sm font-medium ${focus}`}>Help, withdrawal & refunds{receipt.Order.ReturnRequest.length > 0 ? ` · ${receipt.Order.ReturnRequest.length} requests` : ''}</summary>
      <div className="pb-5"><PurchaseSupport orderId={receipt.orderId} canRequest={complete} demo={demo} initialRequests={receipt.Order.ReturnRequest.map(request => ({
        id: request.id, orderId: request.orderId, reason: request.reason, description: request.description,
        status: request.status, sellerNote: request.sellerNote, createdAt: request.createdAt.toISOString(),
        emailStatus: emails.find(email => email.sourceKey === `buyer-request:${request.id}`)?.status ?? null,
      }))} /></div>
    </details>
    <nav aria-label="Receipt navigation" className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
      <Link href="/my-orders" className={`inline-flex min-h-11 items-center underline underline-offset-4 ${focus}`}>My orders</Link>
      {hasDigitalFiles && <Link href="/my-downloads" className={`inline-flex min-h-11 items-center underline underline-offset-4 ${focus}`}>My downloads</Link>}
      {demo && <Link href="/ai" className={`inline-flex min-h-11 items-center underline underline-offset-4 ${focus}`}>Open AI chat</Link>}
      <Link href="/products" className={`inline-flex min-h-11 items-center underline underline-offset-4 ${focus}`}>Browse products</Link>
    </nav>
  </section>;
}
