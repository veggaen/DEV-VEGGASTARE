/** @fileOverview Auth-checked receipt; database capture state alone controls delivery. @stability experimental */
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { moneyString } from '@/lib/payments/showcase-policy';

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/auth/login?callbackUrl=${encodeURIComponent(`/checkout/receipt/${id}`)}`);
  const receipt = await dbPrisma.checkoutAttempt.findUnique({ where: { orderId: id }, include: { Order: { include: {
    OrderItem: true, DownloadToken: { where: { isRevoked: false, expiresAt: { gt: new Date() } }, include: { DigitalAsset: { select: { fileName: true } } } },
  } } } });
  if (!receipt || receipt.userId !== session.user.id) notFound();
  const demo = receipt.environment === 'DEMO', complete = receipt.state === 'COMPLETED';
  const balance = await dbPrisma.aiCreditAccount.findUnique({ where: { id: `${receipt.environment}:${session.user.id}` }, select: { balance: true } });
  return <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{demo ? 'Demo · no payment collected' : receipt.environment === 'SANDBOX' ? 'Sandbox · no real money' : 'PayPal Live'}</p>
    <h1 className="mt-3 text-3xl font-semibold">{complete ? demo ? 'Your demo order is ready' : 'Your order is confirmed' : 'Order awaiting confirmation'}</h1>
    <p className="mt-4 text-muted-foreground">{complete ? 'Your receipt and downloads are available below.' : 'No files or credits are released until payment is verified.'}</p>
    <dl className="mt-8 grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2 sm:p-6">
      <div><dt className="text-sm text-muted-foreground">{demo ? 'Charged' : 'Order total'}</dt><dd className="mt-1 text-xl font-semibold">{demo ? '0.00' : moneyString(receipt.totalOre)} NOK</dd></div>
      <div className="min-w-0"><dt className="text-sm text-muted-foreground">Receipt ID</dt><dd className="mt-1 break-all font-mono text-sm">{receipt.captureId ?? receipt.orderId}</dd></div>
      <div><dt className="text-sm text-muted-foreground">AI credit balance</dt><dd className="mt-1 font-semibold">{balance?.balance ?? 0}{receipt.environment === 'SANDBOX' ? ' test credits' : ' credits'}</dd></div>
      <div><dt className="text-sm text-muted-foreground">Status</dt><dd className="mt-1">{receipt.state.toLowerCase().replaceAll('_', ' ')}</dd></div>
    </dl>
    <ul className="mt-6 divide-y rounded-xl border bg-card px-5 sm:px-6">{receipt.Order.OrderItem.map(item => <li key={item.id} className="flex justify-between gap-4 py-4"><span>{item.title} × {item.quantity}</span><span className="shrink-0">{moneyString(Math.round(item.priceAtTime * 100))} NOK</span></li>)}</ul>
    {complete && receipt.Order.DownloadToken.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold">Your downloads</h2><p className="mt-2 text-sm text-muted-foreground">Private links expire after 24 hours. Stay signed in to this account.</p><div className="mt-4 flex flex-col gap-3">{receipt.Order.DownloadToken.map(file => <a key={file.id} href={`/api/download/${file.token}`} className="inline-flex min-h-12 items-center rounded-lg border bg-card px-4 py-3 font-medium underline underline-offset-4">Download {file.DigitalAsset.fileName}</a>)}</div></section>}
    <div className="mt-8 flex flex-wrap gap-6"><Link href="/ai" className="inline-flex min-h-11 items-center underline">Open AI chat</Link><Link href="/products" className="inline-flex min-h-11 items-center underline">Browse products</Link></div>
  </section>;
}
