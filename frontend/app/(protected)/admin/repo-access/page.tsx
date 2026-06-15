'use client'

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FiGithub, FiRefreshCw } from 'react-icons/fi';

type RepoAccessEvent = {
  id: string;
  eventType: string;
  paymentStatus: string | null;
  orderStatus: string | null;
  processingError: string | null;
  createdAt: string;
};

type RepoAccessOrder = {
  id: string;
  status: string;
  paymentStatus: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

type RepoAccessResponse = {
  order: RepoAccessOrder;
  events: RepoAccessEvent[];
};

export default function AdminRepoAccessPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RepoAccessResponse | null>(null);

  const canAccess = session?.user?.role === 'OWNER' || session?.user?.role === 'ADMIN';

  useEffect(() => {
    if (status !== 'loading' && !canAccess) {
      router.push('/');
    }
  }, [canAccess, router, status]);

  const fetchOrder = useCallback(async (targetOrderId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/github-repo-access/orders/${encodeURIComponent(targetOrderId)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load repo-access status');
      }
      setResult(json);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Failed to load repo-access status');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetry = useCallback(async () => {
    if (!result?.order?.id) return;
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/github-repo-access/orders/${encodeURIComponent(result.order.id)}`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Retry failed');
      }
      await fetchOrder(result.order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  }, [fetchOrder, result?.order?.id]);

  const canRetry = useMemo(() => result?.order?.status === 'COMPLETED', [result?.order?.status]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!canAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 flex items-center justify-center">
            <FiGithub className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Repo Access Ops</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Inspect and retry GitHub repo access grants by order ID.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 space-y-3">
          <label className="text-sm text-zinc-600 dark:text-zinc-300" htmlFor="repo-order-id">
            Order ID
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="repo-order-id"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Paste order id"
              className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={loading || !orderId.trim()}
              onClick={() => fetchOrder(orderId.trim())}
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load status'}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        </div>

        {result && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Order</p>
                  <p className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">{result.order.id}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    Status: <span className="font-semibold">{result.order.status}</span>
                    {result.order.paymentStatus ? ` • Payment: ${result.order.paymentStatus}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canRetry || retrying}
                  onClick={handleRetry}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                  title={!canRetry ? 'Order must be COMPLETED before retrying' : 'Retry repo access grant'}
                >
                  <FiRefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
                  {retrying ? 'Retrying…' : 'Retry grant'}
                </button>
              </div>
              {!canRetry && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Retry is disabled until order status is COMPLETED.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Recent repo-access events
              </div>
              {result.events.length === 0 ? (
                <p className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">No events found for this order yet.</p>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {result.events.map((event) => (
                    <div key={event.id} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-zinc-800 dark:text-zinc-100">{event.eventType}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(event.createdAt).toLocaleString()}</p>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        orderStatus: {event.orderStatus ?? 'n/a'} • paymentStatus: {event.paymentStatus ?? 'n/a'}
                      </p>
                      {event.processingError && (
                        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{event.processingError}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
