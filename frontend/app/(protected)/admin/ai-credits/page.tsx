'use client';

/** @fileOverview Private, scoped credit reporting. Refresh preserves layout, not revoked access. */
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isDemoUserId } from '@/lib/demo-policy';
import { creditReportFailure, parseCreditReport } from '@/lib/ai-credit-report-view';
import type { AiCreditReport } from '@/lib/ai-credit-report';

const count = (value: number) => new Intl.NumberFormat('en-GB').format(value);
const money = (value: number, currency: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
const card = 'min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5';
const frame = 'mx-auto w-full min-w-0 max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8';
const disclosure = 'min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring';

function LoadingReport() {
  return <div role="status" aria-label="Loading credit report" className="space-y-5">
    <span className="sr-only">Loading credit report…</span>
    <div aria-hidden="true" className="grid gap-4 lg:grid-cols-2">{[0, 1].map(index => <Skeleton key={index} className="h-52 rounded-xl" />)}</div>
    <div aria-hidden="true" className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map(index => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>
  </div>;
}

function CreditAccess() {
  const { data: session, status } = useSession();
  const actor = session?.user;
  const allowed = !!actor?.id && actor.role === 'OWNER' && !actor.isDemo && !actor.isImpersonating && !isDemoUserId(actor.id);
  if (status === 'loading') return <div className={frame}><p role="status">Checking access…</p><LoadingReport /></div>;
  if (!allowed) return <div className={frame}><h1 className="text-2xl font-semibold">Owner access required</h1>
    <p className="text-muted-foreground">Sign in with the platform owner account to view this report.</p>
    <Button asChild className="h-11"><Link href="/auth/login?callbackUrl=%2Fadmin%2Fai-credits">Sign in</Link></Button></div>;
  return <CreditReport key={`${actor.id}:${actor.sessionVersion}`} />;
}

function CreditReport() {
  const router = useRouter(), params = useSearchParams();
  const environment = params.get('environment');
  const scope = environment ?? 'current';
  const [result, setResult] = useState<{ scope: string; data?: AiCreditReport; error?: string }>({ scope: '' });
  const [refresh, setRefresh] = useState(0), [pending, setPending] = useState(true), [denied, setDenied] = useState(false);
  const report = !denied && result.scope === scope ? result.data : undefined;
  const error = result.scope === scope ? result.error : undefined;
  const busy = pending || result.scope !== scope;
  useEffect(() => {
    const controller = new AbortController();
    let active = true, timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20_000);
    setPending(true);
    void (async () => {
      try {
        const response = await fetch('/api/admin/ai-credits' + (environment === null ? '' : '?environment=' + encodeURIComponent(environment)), { cache: 'no-store', signal: controller.signal });
        if (!active) return;
        if (response.status === 401 || response.status === 403) { setResult({ scope }); setDenied(true); return; }
        if (!response.ok) throw new Error(creditReportFailure(response.status));
        const data = parseCreditReport(await response.json(), environment);
        if (active) { setResult({ scope, data }); setDenied(false); }
      } catch (reason) {
        if (active) setResult(previous => ({ scope, data: previous.scope === scope ? previous.data : undefined,
          error: timedOut ? 'The report took too long. Try again.'
            : reason instanceof Error && [400, 429, 503].some(status => creditReportFailure(status) === reason.message)
              ? reason.message : 'The report could not be loaded. Try again.' }));
      } finally { clearTimeout(timeout); if (active) setPending(false); }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [environment, scope, refresh]);

  return <section aria-labelledby="credit-report-title" className={frame}>
    <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0"><Link href="/admin" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">← Admin</Link>
        <h1 id="credit-report-title" className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">AI credits &amp; usage</h1>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex">
        <div className="min-w-0"><label htmlFor="credit-environment" className="mb-1 block text-sm font-medium">Environment</label>
          <select id="credit-environment" name="environment" value={environment ?? report?.environment ?? ''}
            onChange={event => router.replace('/admin/ai-credits?environment=' + event.target.value, { scroll: false })}
            className="h-11 w-full min-w-0 max-w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <option value="" disabled>Current deployment</option><option value="LIVE">Live</option><option value="SANDBOX">Sandbox</option><option value="DEMO">Demo</option>
          </select>
        </div>
        <Button variant="outline" className="h-11 gap-2" disabled={busy} onClick={() => setRefresh(value => value + 1)}><RefreshCw aria-hidden="true" className={`size-4 ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`} />Refresh report</Button>
      </div>
    </header>
    <p role="status" className="min-h-5 text-sm text-muted-foreground">{busy ? report ? 'Refreshing report…' : 'Loading report…' : report
      ? `${report.environment === 'LIVE' ? 'Live ledger · real payments' : (report.environment === 'DEMO' ? 'Demo' : 'Sandbox') + ' ledger · no real money'} · Updated ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(report.generatedAt))} UTC`
      : 'Report unavailable'}</p>
    {denied ? <div className={card}><h2 className="font-semibold">Owner access required</h2><p role="alert" className="mt-2 text-sm">Access to this report ended. Sign in again or retry.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" className="h-11" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Retry access</Button><Button asChild className="h-11"><Link href="/auth/login?callbackUrl=%2Fadmin%2Fai-credits">Sign in</Link></Button></div>
    </div> : error && <div role="alert" className={card + ' border-destructive/40'}><h2 className="font-semibold">Credit report unavailable</h2><p className="mt-2 text-sm">{error}{report && ' Showing the last loaded report.'}</p><Button variant="outline" className="mt-3 h-11" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Retry report</Button></div>}
    {!report && !denied && busy && <LoadingReport />}
    {report && <ReportFigures report={report} />}
  </section>;
}

function ReportFigures({ report }: { report: AiCreditReport }) {
  const fuse = report.platformToday;
  const exhausted = fuse.limitMicroUsd === 0 || fuse.requestLimit === 0 || fuse.reservedMicroUsd >= fuse.limitMicroUsd || fuse.requests >= fuse.requestLimit;
  return <>
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
      <section aria-labelledby="platform-fuse" className={card}>
        <div className="flex flex-wrap items-start justify-between gap-2"><h2 id="platform-fuse" className="text-lg font-semibold">Platform safety limit</h2><span className="text-xs text-muted-foreground">{fuse.day} UTC</span></div>
        <p className="mt-3 break-words text-2xl font-semibold tabular-nums">{money(fuse.reservedMicroUsd / 1_000_000, 'USD')} <span className="text-base font-normal text-muted-foreground">/ {money(fuse.limitMicroUsd / 1_000_000, 'USD')}</span></p>
        <p className="mt-1 text-sm text-muted-foreground">Reserved today · {count(fuse.requests)} / {count(fuse.requestLimit)} attempts</p>
        <p className={`mt-3 text-sm font-medium ${exhausted ? 'text-destructive' : 'text-muted-foreground'}`}>{exhausted ? 'Daily allowance exhausted' : 'Shared across this database'}</p>
        <details className="mt-2 border-t border-border"><summary className={disclosure}>How the safety limit works</summary><p className="pb-2 text-sm leading-relaxed text-muted-foreground">All environments and anonymous platform requests in this database share this ceiling. Separate databases have separate limits. Refunds do not replenish it. Reserved amounts are not provider invoices; provider-project limits are an independent safeguard.</p></details>
      </section>
      <section aria-labelledby="payment-totals" className={card}>
        <h2 id="payment-totals" className="text-lg font-semibold">Captured payments</h2>
        {report.payments.currencies.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No captured payments yet.</p> :
          <ul className="mt-3 grid gap-x-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{report.payments.currencies.map(row => <li key={row.currency} className="min-w-0 border-b border-border py-3">
            <h3 className="text-sm font-medium">{row.currency} <span className="font-normal text-muted-foreground">· {count(row.captures)} {row.captures === 1 ? 'capture' : 'captures'}</span></h3>
            <dl className="mt-2 grid grid-cols-2 gap-3"><div className="min-w-0"><dt className="text-xs text-muted-foreground">Gross captured</dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums">{money(row.grossMinor / 100, row.currency)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Refunded / reversed</dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums">{money(row.refundedMinor / 100, row.currency)}</dd></div></dl>
          </li>)}</ul>}
        <p className="mt-3 text-sm text-muted-foreground">{count(report.payments.captures)} captures · recorded currency</p>
        <details className="mt-2 border-t border-border"><summary className={disclosure}>About payment totals</summary><p className="pb-2 text-sm leading-relaxed text-muted-foreground">Verified digital-file and credit purchases, grouped by original payment currency. Pending approvals are excluded. No exchange-rate conversion, fees, taxes or provider costs are applied. This is not a profit statement.</p></details>
      </section>
    </div>
    <section aria-labelledby="credit-position"><h2 id="credit-position" className="mb-3 text-lg font-semibold">Credit position</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric label="Available credits" value={count(report.accounts.available)} />
        <Metric label="Reserved credits" value={count(report.usage.reservedCredits)} caption={`${count(report.usage.pending)} pending ${report.usage.pending === 1 ? 'request' : 'requests'}`} />
        <Metric label="Refund adjustment" value={count(report.accounts.refundAdjustment)} />
        <Metric label="Completed requests" value={count(report.usage.completed)} caption={`${count(report.usage.chargedCredits)} credits used`} />
        <Metric label="Failed requests refunded" value={count(report.usage.refundedRequests)} />
        <Metric label="Provider cost ceiling" value={money(report.usage.costCeilingMicroUsd / 1_000_000, 'USD')} caption="Recorded maximum, not invoice" />
      </div>
      <details className="mt-2"><summary className={disclosure}>About these figures</summary><div className="max-w-3xl space-y-2 pb-2 text-sm leading-relaxed text-muted-foreground"><p>Available is spendable. Reserved credits are already deducted; do not subtract them again. Completed requests include chat, images and video.</p><p>Refund adjustments track spent credits from refunded purchases. Future grants offset them; they never charge a card. Failed requests return customer credits, but provider work may still cost money.</p><p>The provider ceiling covers all recorded account-linked requests in the selected environment, including failures. It is not actual provider spend.</p></div></details>
    </section>
    <section aria-labelledby="credit-accounts"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 id="credit-accounts" className="text-lg font-semibold">Recent credit accounts</h2><p className="text-sm text-muted-foreground">{count(report.accounts.recent.length)} of {count(report.accounts.total)} · read-only</p></div>
      {report.accounts.recent.length === 0 ? <p className={card}>No credit accounts in this environment yet.</p> : <ul className="grid min-w-0 gap-3 md:grid-cols-2">{report.accounts.recent.map(account => <li key={account.userId} className={card}>
        <h3 className="font-medium [overflow-wrap:anywhere]">{account.name || 'Unnamed account'}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Available</dt><dd className="mt-1 font-semibold tabular-nums">{count(account.available)}</dd></div><div><dt className="text-muted-foreground">Refund adjustment</dt><dd className="mt-1 font-semibold tabular-nums">{count(account.refundAdjustment)}</dd></div></dl>
        <details className="mt-2"><summary className={disclosure}>Account reference</summary><p translate="no" className="break-all pb-2 font-mono text-xs text-muted-foreground">{account.userId}</p></details>
      </li>)}</ul>}
    </section>
  </>;
}
function Metric({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return <div className={card}><h3 className="text-sm text-muted-foreground">{label}</h3><p className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</p>{caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}</div>;
}
export default function AdminAiCreditsPage() {
  return <Suspense fallback={<div className={frame}><LoadingReport /></div>}><CreditAccess /></Suspense>;
}
