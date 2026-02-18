'use client'

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FiLoader, FiAlertTriangle, FiCheckCircle, FiCreditCard } from 'react-icons/fi';

type CreditRow = {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  hasAccess: boolean;
  mode: 'none' | 'daily_cap' | 'credit_pack';
  dailyLimit: number;
  todayUsed: number | null;
  todayRemaining: number | null;
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  purchasedProductIds: string[];
  purchasedProducts: string[];
};

type AiCreditsPayload = {
  monetizationEnabled: boolean;
  configuredProductCount: number;
  users: CreditRow[];
};

export default function AdminAiCreditsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [payload, setPayload] = useState<AiCreditsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = session?.user?.role === 'OWNER' || session?.user?.role === 'ADMIN';

  useEffect(() => {
    if (status === 'loading') return;
    if (!isAdmin) {
      router.push('/');
      return;
    }

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/ai-credits', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load AI credits');
        }
        setPayload(data as AiCreditsPayload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load AI credits');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [status, isAdmin, router]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FiLoader className="h-7 w-7 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-lg w-full rounded-xl border border-red-300/40 bg-red-500/10 p-4 text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2 font-medium">
            <FiAlertTriangle />
            AI credits unavailable
          </div>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const rows = payload?.users || [];
  const activeUsers = rows.filter((row) => row.hasAccess).length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">AI Credits</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Monitor SaaS monetization: who bought access, and current usage headroom.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Configured products" value={String(payload?.configuredProductCount ?? 0)} />
          <StatCard label="Users with entitlements" value={String(rows.length)} />
          <StatCard label="Users with active access" value={String(activeUsers)} />
        </div>

        {!payload?.monetizationEnabled && (
          <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            Set <span className="font-medium">AI_PAID_PRODUCT_IDS</span> or <span className="font-medium">AI_PAID_CREDIT_PACK_PRODUCTS</span> to enable monetization tracking.
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
            <FiCreditCard className="h-4 w-4 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Entitlement table</span>
          </div>

          {rows.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">No entitled users found yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Mode</th>
                    <th className="px-4 py-3 font-medium">Usage</th>
                    <th className="px-4 py-3 font-medium">Products</th>
                    <th className="px-4 py-3 font-medium">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.userId} className="border-b border-zinc-100 dark:border-zinc-800/60 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{row.name || 'Unknown user'}</div>
                        <div className="text-zinc-500 dark:text-zinc-400">{row.email || row.userId}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {row.mode === 'credit_pack' ? 'Credit pack' : row.mode === 'daily_cap' ? 'Daily cap' : 'None'}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {row.mode === 'credit_pack'
                          ? `${row.usedCredits}/${row.totalCredits} used • ${row.remainingCredits} left`
                          : row.mode === 'daily_cap'
                            ? `${row.todayUsed ?? 0}/${row.dailyLimit} today • ${row.todayRemaining ?? row.dailyLimit} left`
                            : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        <div className="max-w-md wrap-break-word">{row.purchasedProducts.length ? row.purchasedProducts.join(', ') : '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.hasAccess
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          {row.hasAccess ? (
                            <><FiCheckCircle className="h-3 w-3 mr-1" /> Active</>
                          ) : (
                            'Inactive'
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}
