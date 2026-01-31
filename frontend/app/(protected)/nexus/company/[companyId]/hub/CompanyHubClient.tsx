'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { CompanyDetailsResponse } from '@/lib/types/company';

export default function CompanyHubClient({ companyId }: { companyId: string }) {
  const user = useCurrentUser();
  const [company, setCompany] = useState<CompanyDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await fetch(`/api/companies/${companyId}`);
        if (!res.ok) throw new Error('Failed to fetch company');
        const data = await res.json();
        setCompany(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load company');
      } finally {
        setLoading(false);
      }
    };
    fetchCompany();
  }, [companyId]);

  if (loading) {
    return (
      <div className="w-full">
        <div className="mx-auto w-full max-w-screen-2xl px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-48"></div>
            <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="w-full">
        <div className="mx-auto w-full max-w-screen-2xl px-4 py-12 text-center">
          <p className="text-red-500">{error || 'Company not found'}</p>
        </div>
      </div>
    );
  }

  // Check access
  const hasAccess = user && (
    company.ownerId === user.id ||
    company.creatorId === user.id ||
    company.employees.some(e => e.userId === user.id)
  );

  if (!hasAccess) {
    return (
      <div className="w-full">
        <div className="mx-auto w-full max-w-screen-2xl px-4 py-12 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Access Restricted</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            You must be a member of this company to access the hub.
          </p>
          <Link
            href={`/nexus/company/${company.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            View Company Profile
          </Link>
        </div>
      </div>
    );
  }

  const sortedEmployees = [...company.employees].sort((a, b) => {
    const roleOrder: Record<string, number> = { OWNER: 0, MANAGER: 1, STAFF: 2, USER: 3 };
    return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
  });

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
              <Image
                src={company.logo?.[0] || '/users/avatar.webp'}
                alt={company.name}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{company.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Company Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/nexus/company/${company.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.05]"
            >
              Public Profile
            </Link>
            <Link
              href={`/nexus/company/${company.id}/settings`}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.05]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              Settings
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content area - Announcements/Messages */}
          <div className="lg:col-span-2 space-y-6">
            {/* Announcements section */}
            <div className="rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Announcements</h2>
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-50"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
                <p>No announcements yet</p>
                <p className="text-sm mt-1">Company announcements will appear here</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link
                  href={`/nexus/company/${company.id}/settings`}
                  className="flex flex-col items-center gap-2 rounded-lg border border-black/10 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 dark:text-slate-300"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Add Employee</span>
                </Link>
                <Link
                  href="/products/create"
                  className="flex flex-col items-center gap-2 rounded-lg border border-black/10 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 dark:text-slate-300"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">New Product</span>
                </Link>
                <Link
                  href={`/nexus/company/${company.id}`}
                  className="flex flex-col items-center gap-2 rounded-lg border border-black/10 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 dark:text-slate-300"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">View Store</span>
                </Link>
                <Link
                  href={`/nexus/company/${company.id}/settings`}
                  className="flex flex-col items-center gap-2 rounded-lg border border-black/10 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 dark:text-slate-300"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Settings</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar - Team */}
          <div className="space-y-6">
            <div className="rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Team</h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">{company.employees.length} members</span>
              </div>
              <div className="space-y-3">
                {sortedEmployees.map((employee) => (
                  <div key={employee.id} className="flex items-center gap-3">
                    <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full">
                      <Image
                        src={employee.user.image || '/users/avatar.webp'}
                        alt={employee.user.name || 'User'}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900 dark:text-white truncate">
                        {employee.user.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {employee.jobTitle || employee.role}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      employee.role === 'OWNER' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                      employee.role === 'MANAGER' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {employee.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
