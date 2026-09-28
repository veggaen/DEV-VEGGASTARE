'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminCompanyPage } from '@/lib/admin-company-policy';
import { CompanyAccess } from './CompanyAccess';

const selectClass = 'h-11 w-full min-w-0 rounded-md border border-border bg-input px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
function navigate(changes: Record<string, string>, replace = false) {
  const next = new URLSearchParams(window.location.search); next.delete('limit');
  for (const [key, value] of Object.entries(changes)) if (value) next.set(key, value); else next.delete(key);
  window.history[replace ? 'replaceState' : 'pushState'](null, '', '/admin/companies' + (next.size ? '?' + next : ''));
}
export default function AdminCompaniesPage() { return <CompanyAccess><Directory /></CompanyAccess>; }
function Directory() {
  const params = useSearchParams(), querySearch = (params.get('search') ?? '').slice(0, 100);
  const sortBy = params.get('sortBy') === 'name' ? 'name' : 'createdAt', sortOrder = params.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  const rawPage = Number(params.get('page') ?? 1), page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 1000 ? rawPage : 1;
  const [search, setSearch] = useState(querySearch), [refresh, setRefresh] = useState(0), [pending, setPending] = useState(true), [denied, setDenied] = useState(false);
  const [result, setResult] = useState<{ key: string; data?: AdminCompanyPage; error?: string }>({ key: '' });
  const queryKey = new URLSearchParams({ search: querySearch, page: String(page), limit: '20', sortBy, sortOrder }).toString();
  const waiting = search.trim() !== querySearch, data = !waiting && result.key === queryKey ? result.data : undefined;
  const error = !waiting && result.key === queryKey ? result.error : undefined, busy = pending || waiting || result.key !== queryKey;
  useEffect(() => { setSearch(querySearch); }, [querySearch]);
  useEffect(() => {
    if (search.trim() === querySearch) return;
    const timer = setTimeout(() => navigate({ search: search.trim(), page: '' }, true), 300);
    return () => clearTimeout(timer);
  }, [search, querySearch]);
  useEffect(() => {
    if (denied) return;
    let active = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15_000);
    setPending(true);
    void (async () => {
      try {
        const response = await fetch('/api/admin/companies?' + queryKey, { cache: 'no-store', signal: controller.signal });
        if (!active) return;
        if ([401, 403].includes(response.status)) { setResult({ key: '' }); setDenied(true); return; }
        if (!response.ok) throw new Error();
        const body: AdminCompanyPage = await response.json();
        if (!Array.isArray(body.companies) || !Number.isInteger(body.pagination?.total)) throw new Error();
        if (active) setResult({ key: queryKey, data: body });
      } catch { if (active) setResult(previous => ({ key: queryKey, data: previous.key === queryKey ? previous.data : undefined, error: 'Companies could not be loaded. Try again.' })); }
      finally { clearTimeout(timeout); if (active) setPending(false); }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [queryKey, refresh, denied]);
  if (denied) return <section className="mx-auto max-w-7xl space-y-4 px-4 py-6"><h1 className="text-2xl font-semibold">Companies</h1><p role="alert">Admin access is no longer available. Sign in again or retry.</p><Button className="h-11" onClick={() => setDenied(false)}>Retry access</Button></section>;
  const pages = Math.min(1000, data?.pagination.totalPages ?? 0);
  return <section aria-label="Company administration" className="mx-auto w-full min-w-0 max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8 [overflow-wrap:anywhere]">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Companies</h1><p className="mt-1 text-sm text-muted-foreground">Company records & storefronts.</p></div><Button variant="outline" className="h-11" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh</Button></header>
    <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="min-w-0 sm:col-span-2 lg:col-span-1"><label htmlFor="company-search" className="mb-1.5 block text-sm font-medium">Search companies</label><Input id="company-search" name="search" type="search" autoComplete="off" maxLength={100} placeholder="Name, organisation number or ID…" className="h-11 text-base" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div><label htmlFor="company-sort" className="mb-1.5 block text-sm font-medium">Sort by</label><select id="company-sort" name="sortBy" className={selectClass} value={sortBy} onChange={event => navigate({ sortBy: event.target.value, page: '' })}><option value="createdAt">Created date</option><option value="name">Name</option></select></div>
      <div><label htmlFor="company-order" className="mb-1.5 block text-sm font-medium">Order</label><select id="company-order" name="sortOrder" className={selectClass} value={sortOrder} onChange={event => navigate({ sortOrder: event.target.value, page: '' })}><option value="desc">Descending</option><option value="asc">Ascending</option></select></div>
      <Button variant="ghost" className="h-11" onClick={() => { setSearch(''); navigate({ search: '', sortBy: '', sortOrder: '', page: '' }); }}>Clear filters</Button>
    </div>
    <p role="status" className="min-h-5 text-sm text-muted-foreground tabular-nums">{busy ? data ? 'Refreshing…' : 'Loading companies…' : error ? 'Refresh unavailable' : `${data?.pagination.total.toLocaleString() ?? 0} matching ${data?.pagination.total === 1 ? 'company' : 'companies'}`}</p>
    {error && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"><p role="alert" className="min-w-0 flex-1 text-sm">{error}{data && ' Showing the last loaded companies.'}</p><Button variant="outline" className="h-11" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Retry</Button></div>}
    <div aria-label="Company results" aria-busy={busy} className="rounded-xl border border-border bg-card">
      {!data && busy ? <div aria-hidden className="divide-y divide-border">{Array.from({ length: 5 }, (_, i) => <div key={i} className="min-h-36 space-y-3 p-4 sm:min-h-28"><Skeleton className="h-5 w-60 max-w-full" /><Skeleton className="h-4 w-80 max-w-full" /><Skeleton className="h-11 w-28" /></div>)}</div>
      : data?.companies.length ? <ul className="divide-y divide-border">{data.companies.map(company => <li key={company.id} className="grid min-w-0 items-center gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="min-w-0"><h2 className="font-semibold"><Link className="inline-flex min-h-11 items-center hover:underline" href={'/admin/companies/' + encodeURIComponent(company.id)}>{company.name}</Link></h2><p className="text-sm text-muted-foreground">{company.orgNumber ? `Org. ${company.orgNumber}` : 'Not registered'}{company.orgType ? ` · ${company.orgType}` : ''}</p><p className="mt-1 text-sm text-muted-foreground">Owner: {company.User_Company_ownerIdToUser.name || company.User_Company_ownerIdToUser.id}</p></div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm tabular-nums">{(['Employee', 'Product'] as const).map((key, index) => <div key={key}><dt className="text-xs text-muted-foreground">{['Employees', 'Products'][index]}</dt><dd className="mt-1 font-medium">{company._count[key].toLocaleString()}</dd></div>)}<div><dt className="text-xs text-muted-foreground">Live paid orders</dt><dd className="mt-1 font-medium">{company.checkoutCounts?.livePaid.toLocaleString() ?? '—'}</dd></div></dl>
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="h-11"><Link aria-label={'Details ' + company.name} href={'/admin/companies/' + encodeURIComponent(company.id)}>Details</Link></Button><Button asChild variant="ghost" className="h-11"><Link aria-label={'Edit ' + company.name} href={'/admin/companies/' + encodeURIComponent(company.id) + '/edit'}>Edit</Link></Button></div>
      </li>)}</ul> : !error && <div className="p-8 text-center"><h2 className="font-medium">No matching companies</h2><p className="mt-1 text-sm text-muted-foreground">Try a different name or clear the filters.</p></div>}
    </div>
    {pages > 1 && <nav aria-label="Company pages" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {page} of {pages}</p><div className="flex gap-2"><Button variant="outline" className="h-11" disabled={busy || page <= 1} onClick={() => navigate({ page: String(page - 1) })}>Previous</Button><Button variant="outline" className="h-11" disabled={busy || page >= pages} onClick={() => navigate({ page: String(page + 1) })}>Next</Button></div></nav>}
  </section>;
}
