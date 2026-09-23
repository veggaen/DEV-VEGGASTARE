/** @fileOverview Private buyer credit position and recent ledger activity. @stability active */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MyLibUserAuth } from '@/lib/user-auth';
import { readBuyerCreditHistory, creditEntryLabels } from '@/lib/ai-credit-history';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your AI credits', robots: { index: false, follow: false } };
const number = (value: number) => new Intl.NumberFormat('en-GB').format(value);
const date = (value: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));
const link = 'inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring';

export default async function CreditHistoryPage() {
  const user = await MyLibUserAuth();
  if (!user?.id) redirect('/auth/login?callbackUrl=%2Fai%2Fcredits');
  const limit = await checkRateLimit(`buyer-credit-history:${user.id}`, 'analytics');
  let history: Awaited<ReturnType<typeof readBuyerCreditHistory>> | null = null;
  if (limit.success) {
    try { history = await readBuyerCreditHistory(user.id); } catch { /* Never expose raw database errors. */ }
  }
  return <div className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain">
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
      <header><h1 className="text-balance text-2xl font-semibold">Your AI credits</h1>
        <p className="mt-2 text-sm text-muted-foreground">Prepaid usage, with a fixed credit price shown before each message. No automatic top-ups.</p>
        <div className="mt-4 flex flex-wrap gap-3"><Link href="/ai" className={link}>Back to AI chat</Link>
          {history && history.environment !== 'DEMO' && <Link href="/products/cveggatinterviewcredits01" className={link}>Buy credits</Link>}</div>
      </header>
      {!history ? <section role="alert" className="rounded-xl border border-border p-5"><h2 className="font-semibold">Credit history unavailable</h2>
        <p className="mt-2 mb-4 text-sm text-muted-foreground">{limit.success ? 'We could not load your ledger. Try again shortly.' : 'Too many refreshes. Please wait a minute before trying again.'} No credits were charged.</p>
        <form action="/ai/credits" method="get"><button type="submit" className={link}>Retry credit history</button></form></section> : <>
        <p className="text-sm font-medium">{history.environment === 'LIVE' ? 'Live credits' : history.environment === 'DEMO' ? 'Demo credits · no payment needed' : 'Sandbox credits · no real money'}</p>
        <dl className="grid gap-4 sm:grid-cols-3">
          {[['Available', history.available], ['Reserved', history.reserved], ['Refund adjustment', history.refundAdjustment]].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-border bg-card p-5"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-3xl font-semibold tabular-nums">{number(value as number)}</dd></div>)}
        </dl>
        {history.unclaimedDemoAllowance > 0 && <p className="rounded-xl border border-border p-4 text-sm">Your {history.unclaimedDemoAllowance}-credit demo allowance will be added when you send your first supported message.</p>}
        <section aria-labelledby="credit-explanation" className="space-y-2 text-sm text-muted-foreground">
          <h2 id="credit-explanation" className="font-medium text-foreground">How your balance works</h2>
          <p>Reserved credits are already deducted from Available. {number(history.pendingRequests)} requests are awaiting settlement. A successful reply keeps its reservation; a failed reply returns its credits once. Interrupted requests may take up to two minutes to settle when you return to chat.</p>
          <p>Refund adjustment records credits already used from a refunded purchase. Future credit grants offset it first. It never charges your card. Ledger changes below are not a running available balance.</p>
          <p>Your own API keys are billed directly by their provider. They do not spend Veggat credits. Live, Sandbox and Demo balances stay separate.</p>
        </section>
        <section aria-labelledby="credit-activity"><h2 id="credit-activity" className="text-lg font-semibold">Recent activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">Latest {history.entries.length} entries, up to 50. Times are UTC.</p>
          {history.entries.length === 0 ? <p className="mt-4 rounded-xl border border-border p-5">No credit activity yet. Choose a model in chat to see its price before sending.</p> : <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
            {history.entries.map(entry => <li key={entry.id} className="flex min-w-0 items-start justify-between gap-4 p-4">
              <div className="min-w-0"><h3 className="break-words text-sm font-medium">{creditEntryLabels[entry.kind] ?? 'Credit adjustment'}</h3><time dateTime={entry.createdAt} className="mt-1 block text-xs text-muted-foreground">{date(entry.createdAt)} UTC</time></div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{entry.delta > 0 ? '+' : ''}{number(entry.delta)}<span className="sr-only"> credits</span></span>
            </li>)}
          </ul>}
        </section>
      </>}
    </div>
  </div>;
}
