'use client';

/** @fileOverview Owner ledger overview; cash, credits and reserved costs stay distinct. @stability active */
import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { AiCreditReport } from '@/lib/ai-credit-report';

const count = (value: number) => new Intl.NumberFormat('en-GB').format(value);
const money = (value: number, currency: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
const card = 'min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5';

function LoadingReport() {
  return <div role="status" aria-label="Loading credit report" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }, (_, index) => <div key={index} className={card + ' h-32'}>
      <div className="h-4 w-3/4 rounded bg-muted" /><div className="mt-4 h-8 w-1/2 rounded bg-muted" />
    </div>)}
  </div>;
}

function CreditReport() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const environment = params.get('environment');
  const [report, setReport] = useState<AiCreditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const owner = session?.user?.role === 'OWNER';

  useEffect(() => {
    if (status !== 'authenticated' || !owner) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let active = true;
    void (async () => {
      setLoading(true); setError(null); setReport(null);
      try {
        const response = await fetch('/api/admin/ai-credits' + (environment ? '?environment=' + encodeURIComponent(environment) : ''), { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Report unavailable.');
        if (active) setReport(data as AiCreditReport);
      } catch (reason) {
        if (active) setError(controller.signal.aborted ? 'The report took too long. Try refreshing.' : reason instanceof Error ? reason.message : 'Report unavailable. Try again.');
      } finally { clearTimeout(timeout); if (active) setLoading(false); }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [status, owner, environment, refresh]);

  if (status !== 'loading' && !owner) return <div className="mx-auto max-w-3xl px-4 py-8">
    <h1 className="text-2xl font-semibold">Owner access required</h1>
    <p className="mt-2 text-muted-foreground">This financial report is available only to the platform owner.</p>
  </div>;

  return <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Owner overview</p>
        <h1 className="mt-1 text-balance text-2xl font-semibold sm:text-3xl">AI credits &amp; usage</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Read-only ledger totals. Credits, cash receipts and provider cost ceilings are separate—not a profit statement.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <label htmlFor="credit-environment" className="mb-1 block text-sm font-medium">Environment</label>
          <select id="credit-environment" name="environment" value={environment ?? report?.environment ?? ''}
            onChange={event => router.replace('?environment=' + event.target.value, { scroll: false })}
            className="h-11 max-w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <option value="" disabled>Current deployment</option><option value="LIVE">Live</option><option value="SANDBOX">Sandbox</option><option value="DEMO">Demo</option>
          </select>
        </div>
        <Button variant="outline" className="h-11" disabled={loading || status === 'loading'} onClick={() => setRefresh(value => value + 1)}>Refresh report</Button>
      </div>
    </header>
    {error && <div role="alert" className={card + ' border-destructive/40'}>
      <h2 className="font-semibold">Credit report unavailable</h2><p className="mt-2 text-sm">{error}</p>
      <Button variant="outline" className="mt-3 h-11" onClick={() => setRefresh(value => value + 1)}>Retry report</Button>
    </div>}
    {(loading || status === 'loading') && <LoadingReport />}
    {!loading && report && <>
      <p role="status" className="text-sm text-muted-foreground">
        {report.environment === 'LIVE' ? 'Live ledger · real payments' : (report.environment === 'DEMO' ? 'Demo' : 'Sandbox') + ' ledger · no real money'}.
        {' Updated '}{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(report.generatedAt))} UTC.
      </p>
      <section aria-labelledby="credit-position">
        <h2 id="credit-position" className="mb-3 text-lg font-semibold">Credit position</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Available credits" value={count(report.accounts.available)} detail="Spendable balance across the selected environment." />
          <Metric label="Reserved credits" value={count(report.usage.reservedCredits)} detail={count(report.usage.pending) + ' unsettled requests. Already deducted from available; do not subtract again.'} />
          <Metric label="Refund adjustment" value={count(report.accounts.refundAdjustment)} detail="Previously spent credits from refunded purchases. Future grants offset this; it never charges a card." />
          <Metric label="Completed messages" value={count(report.usage.completed)} detail={count(report.usage.chargedCredits) + ' credits charged for completed requests, including demo credits where selected.'} />
          <Metric label="Failed requests refunded" value={count(report.usage.refundedRequests)} detail="Customer credits returned. Provider work may still have a cost." />
          <Metric label="Recorded provider cost ceiling" value={money(report.usage.costCeilingMicroUsd / 1_000_000, 'USD')} detail="Selected environment’s account-linked requests, including failures. A reserved maximum—not an actual provider invoice." />
        </div>
      </section>
      <section aria-labelledby="payment-totals">
        <h2 id="payment-totals" className="mb-3 text-lg font-semibold">Verified reviewer payments</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric label="Gross captured" value={money(report.payments.grossOre / 100, 'NOK')} detail={count(report.payments.captures) + ' verified captures. Includes digital files and credit packs; excludes pending approvals.'} />
          <Metric label="Refunded or reversed" value={money(report.payments.refundedOre / 100, 'NOK')} detail="Verified payment adjustments. Fees, tax, foreign exchange and chargeback costs are not included here." />
        </div>
      </section>
      <section aria-labelledby="platform-fuse" className={card}>
        <h2 id="platform-fuse" className="text-lg font-semibold">Platform safety limit · {report.platformToday.day} UTC</h2>
        <p className="mt-2 text-lg font-medium tabular-nums">{money(report.platformToday.reservedMicroUsd / 1_000_000, 'USD')} reserved / {money(report.platformToday.limitMicroUsd / 1_000_000, 'USD')} daily ceiling</p>
        <p className="mt-2 text-sm text-muted-foreground">{count(report.platformToday.requests)} / {count(report.platformToday.requestLimit)} platform attempts. Shared by all environments and anonymous requests in this database, regardless of the filter above. Separate databases have separate limits. Refunds do not replenish this allowance. Provider-project limits remain an independent safeguard.</p>
      </section>
      <section aria-labelledby="credit-accounts">
        <h2 id="credit-accounts" className="text-lg font-semibold">Recent credit accounts</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">Showing {count(report.accounts.recent.length)} of {count(report.accounts.total)} accounts, most recently updated first. No balances can be edited here.</p>
        {report.accounts.recent.length === 0 ? <div className={card}>No credit accounts in this environment yet.</div> : <ul className="grid gap-4 md:grid-cols-2">
          {report.accounts.recent.map(account => <li key={account.userId} className={card}>
            <h3 className="break-words font-medium">{account.name || 'Unnamed account'}</h3>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{account.userId}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Available</dt><dd className="mt-1 font-semibold tabular-nums">{count(account.available)}</dd></div>
              <div><dt className="text-muted-foreground">Refund adjustment</dt><dd className="mt-1 font-semibold tabular-nums">{count(account.refundAdjustment)}</dd></div>
            </dl>
          </li>)}
        </ul>}
      </section>
    </>}
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className={card}><h3 className="text-sm text-muted-foreground">{label}</h3>
    <p className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</p>
    <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
  </div>;
}
export default function AdminAiCreditsPage() {
  return <Suspense fallback={<div className="mx-auto max-w-6xl p-4"><LoadingReport /></div>}><CreditReport /></Suspense>;
}
