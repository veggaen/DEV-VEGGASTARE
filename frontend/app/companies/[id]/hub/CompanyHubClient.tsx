'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import BannerThemeWrapper from '@/components/uicustom/banner/BannerThemeWrapper';
import dynamic from 'next/dynamic';
import { FiTrendingUp, FiEye, FiUsers, FiZap, FiPackage, FiMessageCircle, FiDollarSign } from 'react-icons/fi';
import type { CompanyDetailsResponse } from '@/lib/types/company';
import type { PillarBreakdown } from '@/components/uicustom/reach/ReachRadarChart';
import type { ReachBadge } from '@/components/uicustom/reach/ReachBadges';

// Dynamic imports for chart components (no SSR)
const ReachRadarChart = dynamic(() => import('@/components/uicustom/reach/ReachRadarChart'), { ssr: false });
const MomentumTimeline = dynamic(() => import('@/components/uicustom/reach/MomentumTimeline'), { ssr: false });
const ReachBadges = dynamic(() => import('@/components/uicustom/reach/ReachBadges'), { ssr: false });
const TaxHelperDashboard = dynamic(() => import('@/components/uicustom/tax/TaxHelperDashboard'), { ssr: false });

interface CompanyReachData {
  companyId: string;
  companyName: string;
  reachLifetime: number;
  reachMomentum: number;
  employeePulseBonus: number;
  pillarBreakdown: PillarBreakdown;
  totalViews: number;
  uniqueViewers: number;
  pulseCount: number;
  productCount: number;
  momentumTrend: { date: string; momentum: number; lifetime?: number; views?: number; engagements?: number }[];
  topEmployees?: { userId: string; name: string | null; image: string | null; role: string; reachLifetime: number; reachMomentum: number }[];
  topProducts: { id: string; name: string; image: string | null; reachLifetime: number; reachMomentum: number; views: number }[];
  topPulses: { id: string; title: string | null; reachMomentum: number; views: number }[];
  badges: ReachBadge[];
}

export default function CompanyHubClient({ companyId }: { companyId: string }) {
  const user = useCurrentUser();
  const [company, setCompany] = useState<CompanyDetailsResponse | null>(null);
  const [reachData, setReachData] = useState<CompanyReachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'analytics' | 'tax'>('overview');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [companyRes, reachRes] = await Promise.all([
          fetch(`/api/companies/${companyId}`),
          fetch(`/api/companies/${companyId}/reach`),
        ]);
        if (!companyRes.ok) throw new Error('Failed to fetch company');
        const companyData = await companyRes.json();
        setCompany(companyData);

        if (reachRes.ok) {
          const rd = await reachRes.json();
          setReachData(rd);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load company');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [companyId]);

  if (loading) {
    return (
      <div className="w-full">
        <div className="mx-auto w-full max-w-screen-2xl px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-48"></div>
            <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
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
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Access Restricted</h1>
          <p className="text-zinc-600 dark:text-zinc-300 mb-6">
            You must be a member of this company to access the hub.
          </p>
          <Link
            href={`/companies/${company.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
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

  const banner = company.bannerImage?.[0] ?? null;

  return (
    <BannerThemeWrapper bannerUrl={banner} className="w-full">
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
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">{company.name}</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Company Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/companies/${company.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-200 dark:hover:bg-white/[0.05]"
            >
              Public Profile
            </Link>
            <Link
              href={`/companies/${company.id}/settings`}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-200 dark:hover:bg-white/[0.05]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              Settings
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section Toggle */}
            <div className="flex gap-2 bg-muted/30 border border-border/50 p-1 rounded-xl w-fit">
              <button
                onClick={() => setActiveSection('overview')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === 'overview'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveSection('analytics')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === 'analytics'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FiTrendingUp className="inline h-4 w-4 mr-1.5" />
                Reach Analytics
              </button>
              <button
                onClick={() => setActiveSection('tax')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === 'tax'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FiDollarSign className="inline h-4 w-4 mr-1.5" />
                Tax Helper
              </button>
            </div>

            {activeSection === 'overview' ? (
              <>
                {/* Reach Score Summary Cards */}
                {reachData && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="flex items-center gap-2 mb-1">
                        <FiZap className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs text-muted-foreground">Momentum</span>
                      </div>
                      <div className="text-2xl font-bold text-emerald-500 tabular-nums">
                        {reachData.reachMomentum.toFixed(0)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="flex items-center gap-2 mb-1">
                        <FiTrendingUp className="h-4 w-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground">Lifetime</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-500 tabular-nums">
                        {reachData.reachLifetime.toFixed(0)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="flex items-center gap-2 mb-1">
                        <FiEye className="h-4 w-4 text-purple-500" />
                        <span className="text-xs text-muted-foreground">Total Views</span>
                      </div>
                      <div className="text-2xl font-bold text-purple-500 tabular-nums">
                        {reachData.totalViews.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="flex items-center gap-2 mb-1">
                        <FiUsers className="h-4 w-4 text-pink-500" />
                        <span className="text-xs text-muted-foreground">Unique Viewers</span>
                      </div>
                      <div className="text-2xl font-bold text-pink-500 tabular-nums">
                        {reachData.uniqueViewers.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Badges */}
                {reachData?.badges && reachData.badges.some(b => b.earned) && (
                  <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                      🏆 Reach Badges
                    </h3>
                    <ReachBadges badges={reachData.badges} compact />
                  </div>
                )}

                {/* Announcements section */}
                <div className="rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Announcements</h2>
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-50"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
                    <p>No announcements yet</p>
                    <p className="text-sm mt-1">Company announcements will appear here</p>
                  </div>
                </div>
              </>
            ) : activeSection === 'analytics' ? (
              <>
                {/* ─── Full Analytics View ─────────────────────────── */}
                {reachData ? (
                  <div className="space-y-6">
                    {/* Radar Chart + Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          7-Pillar Breakdown
                        </h3>
                        <ReachRadarChart data={reachData.pillarBreakdown} size={240} />
                      </div>
                      <div className="rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          Momentum Trend (30d)
                        </h3>
                        <MomentumTimeline data={reachData.momentumTrend} showViews height={240} />
                      </div>
                    </div>

                    {/* Key metrics row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03] text-center">
                        <div className="text-xs text-muted-foreground mb-1">Pulses</div>
                        <div className="text-xl font-bold text-foreground">{reachData.pulseCount}</div>
                      </div>
                      <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03] text-center">
                        <div className="text-xs text-muted-foreground mb-1">Products</div>
                        <div className="text-xl font-bold text-foreground">{reachData.productCount}</div>
                      </div>
                      <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03] text-center">
                        <div className="text-xs text-muted-foreground mb-1">Momentum</div>
                        <div className="text-xl font-bold text-emerald-500">{reachData.reachMomentum.toFixed(0)}</div>
                      </div>
                      <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03] text-center">
                        <div className="text-xs text-muted-foreground mb-1">Lifetime</div>
                        <div className="text-xl font-bold text-blue-500">{reachData.reachLifetime.toFixed(0)}</div>
                      </div>
                    </div>

                    {/* Top Products by Momentum */}
                    {reachData.topProducts.length > 0 && (
                      <div className="rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                          <FiPackage className="h-4 w-4 text-amber-500" />
                          Top Products by Momentum
                        </h3>
                        <div className="space-y-2">
                          {reachData.topProducts.map((product, i) => (
                            <Link
                              key={product.id}
                              href={`/products/${product.id}`}
                              className="flex items-center gap-3 rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors"
                            >
                              <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                              {product.image && (
                                <div className="relative h-8 w-8 rounded overflow-hidden flex-none">
                                  <Image src={product.image} alt={product.name} fill className="object-cover" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">{product.name}</div>
                                <div className="text-[11px] text-muted-foreground">{product.views.toLocaleString()} views</div>
                              </div>
                              <div className="text-sm font-semibold text-emerald-500 tabular-nums">
                                {product.reachMomentum.toFixed(0)}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Pulses by Momentum */}
                    {reachData.topPulses.length > 0 && (
                      <div className="rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                          <FiMessageCircle className="h-4 w-4 text-blue-500" />
                          Top Pulses by Momentum
                        </h3>
                        <div className="space-y-2">
                          {reachData.topPulses.map((pulse, i) => (
                            <Link
                              key={pulse.id}
                              href={`/pulse/${pulse.id}`}
                              className="flex items-center gap-3 rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors"
                            >
                              <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">{pulse.title || 'Untitled pulse'}</div>
                                <div className="text-[11px] text-muted-foreground">{pulse.views.toLocaleString()} views</div>
                              </div>
                              <div className="text-sm font-semibold text-emerald-500 tabular-nums">
                                {pulse.reachMomentum.toFixed(0)}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Badges - Full View */}
                    <div className="rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                        🏆 Reach Badges & Milestones
                      </h3>
                      <ReachBadges badges={reachData.badges} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-black/10 bg-white p-12 text-center dark:border-white/10 dark:bg-white/[0.03]">
                    <FiTrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Reach analytics will appear as your company gains engagement</p>
                  </div>
                )}
              </>
            ) : activeSection === 'tax' ? (
              <TaxHelperDashboard companyId={companyId} />
            ) : null}

            {/* Quick Actions — always visible */}
            <div className="rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link
                  href={`/companies/${company.id}/settings`}
                  className="flex flex-col items-center gap-2 rounded-lg border border-black/10 bg-zinc-50 p-4 text-center transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600 dark:text-zinc-300"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Add Employee</span>
                </Link>
                <Link
                  href={`/products/create?source=company-hub&companyId=${encodeURIComponent(company.id)}`}
                  className="flex flex-col items-center gap-2 rounded-lg border border-black/10 bg-zinc-50 p-4 text-center transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600 dark:text-zinc-300"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">New Product</span>
                </Link>
                <Link
                  href={`/companies/${company.id}`}
                  className="flex flex-col items-center gap-2 rounded-lg border border-black/10 bg-zinc-50 p-4 text-center transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600 dark:text-zinc-300"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">View Store</span>
                </Link>
                <Link
                  href={`/companies/${company.id}/settings`}
                  className="flex flex-col items-center gap-2 rounded-lg border border-black/10 bg-zinc-50 p-4 text-center transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600 dark:text-zinc-300"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Settings</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar - Team + Reach Leaders */}
          <div className="space-y-6">
            {/* Top Reach Contributors */}
            {reachData?.topEmployees && reachData.topEmployees.length > 0 && (
              <div className="rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center gap-2 mb-4">
                  <FiZap className="h-4 w-4 text-emerald-500" />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Top Contributors</h2>
                </div>
                <div className="space-y-3">
                  {reachData.topEmployees.map((emp, i) => (
                    <div key={emp.userId} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-4 text-right">{i + 1}</span>
                      <div className="relative h-8 w-8 flex-none overflow-hidden rounded-full">
                        <Image
                          src={emp.image || '/users/avatar.webp'}
                          alt={emp.name || 'Employee'}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">{emp.name}</div>
                        <div className="text-[11px] text-muted-foreground">{emp.role}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-emerald-500 tabular-nums">{emp.reachMomentum.toFixed(0)}</div>
                        <div className="text-[10px] text-muted-foreground">momentum</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Team</h2>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{company.employees.length} members</span>
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
                      <div className="font-medium text-zinc-900 dark:text-white truncate">
                        {employee.user.name}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {employee.jobTitle || employee.role}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      employee.role === 'OWNER' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                      employee.role === 'MANAGER' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                      'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
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
    </BannerThemeWrapper>
  );
}
