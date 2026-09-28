'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiChevronLeft, FiChevronRight, FiRefreshCw, FiSearch, FiUsers } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { isDemoUserId } from '@/lib/demo-policy';

interface DirectoryUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: 'OWNER' | 'ADMIN' | 'USER';
  createdAt: string;
  emailVerified: string | null;
  _count: { Company_Company_ownerIdToUser: number; Employee: number; Order: number };
}
interface DirectoryData {
  users: DirectoryUser[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
type Result = { key: string; data?: DirectoryData; error?: string };
const selectClass = 'h-11 w-full min-w-0 rounded-md border border-border bg-input px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelClass = 'mb-1.5 block text-sm font-medium';
const roleNames = { OWNER: 'Owner', ADMIN: 'Admin', USER: 'User' };

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const actor = session?.user;
  const allowed = !!actor?.id && !isDemoUserId(actor.id) && (actor.role === 'OWNER' || actor.role === 'ADMIN');
  useEffect(() => {
    if (status !== 'loading' && !allowed) router.replace('/');
  }, [status, allowed, router]);

  // Unmount private rows immediately on sign-out, role loss or account change.
  if (status === 'loading' || !allowed) return <p role="status" className="p-6 text-sm text-muted-foreground">Checking access…</p>;
  return <UserDirectory key={actor.id + ':' + actor.role} />;
}

function UserDirectory() {
  const params = useSearchParams();
  const querySearch = (params.get('search') ?? '').slice(0, 100);
  const role = ['OWNER', 'ADMIN', 'USER'].includes(params.get('role') ?? '') ? params.get('role')! : 'all';
  const sortBy = ['name', 'email'].includes(params.get('sortBy') ?? '') ? params.get('sortBy')! : 'createdAt';
  const sortOrder = params.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  const rawPage = Number(params.get('page') ?? 1);
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 1000 ? rawPage : 1;
  const [search, setSearch] = useState(querySearch);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<Result>({ key: '' });
  const query = new URLSearchParams({ page: String(page), limit: '20', search: querySearch, sortBy, sortOrder });
  if (role !== 'all') query.set('role', role);
  const queryKey = query.toString();
  const resultKey = queryKey + ':' + refresh;
  const waitingSearch = search.trim() !== querySearch;
  const current = result.key === resultKey && !waitingSearch;
  const data = current ? result.data : undefined;
  const error = current ? result.error : undefined;
  const busy = !data && !error;

  function navigate(changes: Record<string, string>) {
    const next = new URLSearchParams(window.location.search);
    next.delete('limit');
    for (const [name, value] of Object.entries(changes)) {
      if (!value || value === 'all') next.delete(name);
      else next.set(name, value);
    }
    window.history.replaceState(null, '', '/admin/users?' + next.toString());
  }

  useEffect(() => { setSearch(querySearch); }, [querySearch]);
  useEffect(() => {
    if (search.trim() === querySearch) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(window.location.search);
      next.delete('limit');
      next.set('page', '1');
      next.set('search', search.trim());
      window.history.replaceState(null, '', '/admin/users?' + next.toString());
    }, 300);
    return () => clearTimeout(timer);
  }, [search, querySearch]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
    async function load() {
      try {
        const response = await fetch('/api/admin/users?' + queryKey, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) {
          const message = response.status === 401 || response.status === 403
            ? 'Your admin access is no longer available. Sign in again.'
            : response.status === 429 ? 'Too many requests. Wait a moment, then retry.' : 'Users could not be loaded. Try again.';
          if (active) setResult({ key: resultKey, error: message });
          return;
        }
        const body: DirectoryData = await response.json();
        if (!Array.isArray(body.users) || !body.pagination || !Number.isInteger(body.pagination.total)) throw new Error('Invalid directory');
        if (active) setResult({ key: resultKey, data: body });
      } catch {
        if (active) setResult({ key: resultKey, error: timedOut ? 'The request took too long. Try again.' : 'Connection lost. Check your connection and retry.' });
      } finally { clearTimeout(timeout); }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [queryKey, resultKey]);

  const reset = () => { setSearch(''); window.history.replaceState(null, '', '/admin/users'); };
  const pages = Math.min(data?.pagination.totalPages ?? 0, 1000);
  return (
    <section aria-labelledby="users-title" className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="users-title" className="text-2xl font-semibold tracking-tight">User management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Accounts, roles and activity.</p>
        </div>
        <Button type="button" variant="outline" className="h-11 gap-2" disabled={busy} onClick={() => setRefresh(value => value + 1)}>
          <FiRefreshCw aria-hidden="true" /> Refresh
        </Button>
      </header>
      <div className="mb-5 grid min-w-0 grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(16rem,1fr)_9rem_10rem_10rem]">
        <div className="col-span-2 lg:col-span-1">
          <label htmlFor="directory-search" className={labelClass}>Search users</label>
          <div className="relative">
            <FiSearch aria-hidden="true" className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input id="directory-search" name="search" type="search" autoComplete="off" maxLength={100}
              placeholder="Name, email or ID…" value={search} onChange={event => setSearch(event.target.value)} className="pl-10 text-base" />
          </div>
        </div>
        <div>
          <label htmlFor="directory-role" className={labelClass}>Role</label>
          <select id="directory-role" name="role" value={role} onChange={event => navigate({ role: event.target.value, page: '1', search: search.trim() })} className={selectClass}>
            <option value="all">All roles</option><option value="OWNER">Owner</option><option value="ADMIN">Admin</option><option value="USER">User</option>
          </select>
        </div>
        <div>
          <label htmlFor="directory-sort" className={labelClass}>Sort by</label>
          <select id="directory-sort" name="sortBy" value={sortBy} onChange={event => navigate({ sortBy: event.target.value, page: '1', search: search.trim() })} className={selectClass}>
            <option value="createdAt">Join date</option><option value="name">Name</option><option value="email">Email</option>
          </select>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <label htmlFor="directory-order" className={labelClass}>Order</label>
          <select id="directory-order" name="sortOrder" value={sortOrder} onChange={event => navigate({ sortOrder: event.target.value, page: '1', search: search.trim() })} className={selectClass}>
            <option value="desc">{sortBy === 'createdAt' ? 'Newest first' : 'Z to A'}</option>
            <option value="asc">{sortBy === 'createdAt' ? 'Oldest first' : 'A to Z'}</option>
          </select>
        </div>
      </div>
      <p role="status" className="mb-3 min-h-5 text-sm text-muted-foreground tabular-nums">
        {busy ? 'Loading users…' : error ? 'Directory unavailable' : (data?.pagination.total ?? 0).toLocaleString() + ' matching users'}
      </p>
      <div aria-busy={busy} aria-label="User directory" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        {busy ? (
          <div aria-hidden="true" className="divide-y divide-border">
            {Array.from({ length: 5 }, (_, index) => <div key={index} className="flex min-h-32 items-center gap-4 p-4 sm:min-h-24">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-4 w-64 max-w-full" /></div>
            </div>)}
          </div>
        ) : error ? (
          <div className="space-y-4 p-6"><p role="alert" className="text-sm">{error}</p><Button type="button" variant="outline" className="h-11" onClick={() => setRefresh(value => value + 1)}>Retry</Button></div>
        ) : !data?.users.length ? (
          <div className="p-8 text-center"><FiUsers aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="font-medium">No users found</h2>
            <Button type="button" variant="link" className="mt-2 h-11" onClick={reset}>Clear filters</Button>
          </div>
        ) : <ul className="divide-y divide-border">
          {data.users.map(user => <li key={user.id} className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 p-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center">
            <Avatar className="h-10 w-10">
              <AvatarImage alt="" src={user.image ?? undefined} />
              <AvatarFallback>{(user.name || user.email || '?').slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{user.name || 'Unnamed user'}</span>
                <Badge variant="secondary">{roleNames[user.role]}</Badge>
              </div>
              <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{user.email || 'No email'}{user.emailVerified && <span className="sr-only"> · Email verified</span>}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Joined {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(user.createdAt))}</span>
                <span>{user._count.Company_Company_ownerIdToUser.toLocaleString()} companies</span>
                <span>{user._count.Employee.toLocaleString()} memberships</span>
                <span>{user._count.Order.toLocaleString()} orders</span>
              </div>
            </div>
            <div className="col-start-2 flex flex-wrap gap-2 sm:col-start-auto">
              <Button asChild variant="outline" className="h-11"><Link prefetch={false} href={'/admin/users/' + encodeURIComponent(user.id)}>Manage<span className="sr-only"> {user.name || user.email || 'user'}</span></Link></Button>
              <Button asChild variant="ghost" className="h-11"><Link prefetch={false} href={'/profile/' + encodeURIComponent(user.id)}>Profile<span className="sr-only"> {user.name || user.email || 'user'}</span></Link></Button>
            </div>
          </li>)}
        </ul>}
        {!!data && pages > 1 && <nav aria-label="User pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
          <span className="text-sm text-muted-foreground tabular-nums">Page {page} of {pages}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 gap-1" disabled={page <= 1} onClick={() => navigate({ page: String(page - 1) })}><FiChevronLeft aria-hidden="true" />Previous</Button>
            <Button type="button" variant="outline" className="h-11 gap-1" disabled={page >= pages} onClick={() => navigate({ page: String(page + 1) })}>Next<FiChevronRight aria-hidden="true" /></Button>
          </div>
        </nav>}
        {!!data && !data.users.length && page > 1 && <Button type="button" variant="link" className="m-4 h-11" onClick={() => navigate({ page: '1' })}>First page</Button>}
      </div>
    </section>
  );
}
