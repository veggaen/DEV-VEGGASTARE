'use client';

/**
 * @fileOverview  Company hub — the private workspace for members: reach at a
 *                glance, analytics, the tax helper, quick actions and the team.
 *                Cards are trailing-box grids; colours are tokens.
 * @stability     evolving
 */

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { FiTrendingUp, FiEye, FiUsers, FiZap, FiPackage, FiMessageCircle, FiDollarSign, FiSettings, FiPlus, FiExternalLink, FiUserPlus, FiVolume2, FiAward } from 'react-icons/fi';
import BannerThemeWrapper from '@/components/uicustom/banner/BannerThemeWrapper';
import type { CompanyDetailsResponse } from '@/lib/types/company';
import type { PillarBreakdown } from '@/components/uicustom/reach/ReachRadarChart';
import type { ReachBadge } from '@/components/uicustom/reach/ReachBadges';
import { CompanyReadNotice } from '@/components/uicustom/company/company-read-notice';
import { PageHeader } from '@/components/uicustom/chrome/page-header';
import { HoverChaser } from '@/components/uicustom/chrome/hover-chaser';
import { Segmented, StatusPill, settingsCard } from '@/components/uicustom/settings/settings-primitives';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

type Section = 'overview' | 'analytics' | 'tax';
const roleTone = (role: string): 'warning' | 'accent' | 'neutral' => (role === 'OWNER' ? 'warning' : role === 'MANAGER' ? 'accent' : 'neutral');

function Stat({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: boolean }) {
  return (
    <div data-chase className={cn(settingsCard, 'p-4')}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon aria-hidden="true" className="size-3.5 text-brand-accent" />{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold tabular-nums', accent ? 'text-brand-accent-hover dark:text-brand-accent-light' : 'text-foreground')}>{value}</p>
    </div>
  );
}

function CardTitle({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  return <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">{Icon && <Icon aria-hidden="true" className="size-4 text-brand-accent" />}{children}</h3>;
}

export default function CompanyHubClient({ companyId }: { companyId: string }) {
  const user = useCurrentUser();
  const [company, setCompany] = useState<CompanyDetailsResponse | null>(null);
  const [reachData, setReachData] = useState<CompanyReachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const [activeSection, setActiveSection] = useState<Section>('overview');

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true); setError(null); setAccessStatus(null);
      try {
        const companyRes = await fetch(`/api/companies/${encodeURIComponent(companyId)}`, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
        if (!active) return;
        if (!companyRes.ok) { setAccessStatus(companyRes.status); throw new Error('Company could not load'); }
        const companyData = await companyRes.json();
        if (!active) return;
        setCompany(companyData);
        const reachRes = await fetch(`/api/companies/${encodeURIComponent(companyId)}/reach`, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
        if (reachRes.ok) {
          const rd = await reachRes.json();
          if (active) setReachData(rd);
        }
      } catch {
        if (active) { setCompany(null); setError('Company could not load'); }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [companyId, retry]);

  if (loading) {
    return (
      <div role="status" aria-label="Loading company hub" className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-4 motion-safe:animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-muted" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted" style={{ opacity: 1 - i * 0.18 }} />)}</div>
          <div className="h-64 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !company) {
    return <CompanyReadNotice companyId={companyId} status={accessStatus} section="hub" retry={() => setRetry(value => value + 1)} />;
  }

  const hasAccess = user && (company.ownerId === user.id || user.role === 'ADMIN' || user.role === 'OWNER' || company.employees.some(e => e.userId === user.id));
  if (!hasAccess) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-12 text-center">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">Members only</h1>
        <p className="mb-6 text-muted-foreground">You must be part of this company to open its hub.</p>
        <Button asChild variant="vegaNormalBtn" className="min-h-11"><Link href={`/companies/${company.id}`}>View the public storefront</Link></Button>
      </div>
    );
  }

  const sortedEmployees = [...company.employees].sort((a, b) => {
    const roleOrder: Record<string, number> = { OWNER: 0, MANAGER: 1, STAFF: 2, USER: 3 };
    return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
  });
  const banner = company.bannerImage?.[0] ?? null;
  const quickActions = [
    { href: `/companies/${company.id}/settings`, label: 'Add employee', description: 'Invite someone to the team', icon: FiUserPlus },
    { href: `/products/create?source=company-hub&companyId=${encodeURIComponent(company.id)}`, label: 'New product', description: 'List something for sale', icon: FiPlus },
    { href: `/companies/${company.id}`, label: 'View storefront', description: 'What buyers see', icon: FiExternalLink },
    { href: `/companies/${company.id}/settings`, label: 'Settings', description: 'Details, payouts, team', icon: FiSettings },
  ];

  return (
    <BannerThemeWrapper bannerUrl={banner} className="w-full">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Company hub"
          title={<span className="flex items-center gap-3"><span className="relative size-10 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-card"><Image src={company.logo?.[0] || '/users/avatar.webp'} alt="" fill sizes="40px" className="object-cover" /></span>{company.name}</span>}
          description="Reach, team and the day-to-day tools for this company. Only members see this page."
          actions={<>
            <Button asChild variant="vegaNormalBtn" className="min-h-11 gap-2"><Link href={`/companies/${company.id}`}><FiExternalLink aria-hidden="true" className="size-4" />Public profile</Link></Button>
            <Button asChild variant="vegaNormalBtn" className="min-h-11 gap-2"><Link href={`/companies/${company.id}/settings`}><FiSettings aria-hidden="true" className="size-4" />Settings</Link></Button>
          </>}
          className="mb-6"
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Segmented<Section>
              ariaLabel="Hub section"
              value={activeSection}
              onChange={setActiveSection}
              className="max-w-md"
              options={[{ id: 'overview', label: 'Overview' }, { id: 'analytics', label: 'Reach analytics' }, { id: 'tax', label: 'Tax helper' }]}
            />

            {activeSection === 'overview' ? (
              <>
                {reachData && (
                  <HoverChaser className="grid grid-cols-2 gap-3 md:grid-cols-4" boxClassName="rounded-2xl">
                    <Stat icon={FiZap} label="Momentum" value={reachData.reachMomentum.toFixed(0)} accent />
                    <Stat icon={FiTrendingUp} label="Lifetime reach" value={reachData.reachLifetime.toFixed(0)} />
                    <Stat icon={FiEye} label="Total views" value={reachData.totalViews.toLocaleString()} />
                    <Stat icon={FiUsers} label="Unique viewers" value={reachData.uniqueViewers.toLocaleString()} />
                  </HoverChaser>
                )}

                {reachData?.badges && reachData.badges.some(b => b.earned) && (
                  <div className={cn(settingsCard, 'p-4')}>
                    <CardTitle icon={FiAward}>Reach badges</CardTitle>
                    <ReachBadges badges={reachData.badges} compact />
                  </div>
                )}

                <div className={cn(settingsCard, 'p-5')}>
                  <CardTitle icon={FiVolume2}>Announcements</CardTitle>
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">No announcements yet</p>
                    <p className="mt-1">Company announcements to the team will appear here.</p>
                  </div>
                </div>
              </>
            ) : activeSection === 'analytics' ? (
              reachData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className={cn(settingsCard, 'p-5')}>
                      <CardTitle>7-pillar breakdown</CardTitle>
                      <ReachRadarChart data={reachData.pillarBreakdown} size={240} />
                    </div>
                    <div className={cn(settingsCard, 'p-5')}>
                      <CardTitle>Momentum trend (30d)</CardTitle>
                      <MomentumTimeline data={reachData.momentumTrend} showViews height={240} />
                    </div>
                  </div>
                  <HoverChaser className="grid grid-cols-2 gap-3 md:grid-cols-4" boxClassName="rounded-2xl">
                    <Stat icon={FiMessageCircle} label="Pulses" value={String(reachData.pulseCount)} />
                    <Stat icon={FiPackage} label="Products" value={String(reachData.productCount)} />
                    <Stat icon={FiZap} label="Momentum" value={reachData.reachMomentum.toFixed(0)} accent />
                    <Stat icon={FiTrendingUp} label="Lifetime" value={reachData.reachLifetime.toFixed(0)} />
                  </HoverChaser>

                  {reachData.topProducts.length > 0 && (
                    <div className={cn(settingsCard, 'p-4')}>
                      <CardTitle icon={FiPackage}>Top products by momentum</CardTitle>
                      <HoverChaser className="space-y-0.5" boxClassName="rounded-xl">
                        {reachData.topProducts.map((product, i) => (
                          <Link key={product.id} href={`/products/${product.id}`} data-chase className="flex items-center gap-3 rounded-xl p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <span className="w-5 text-right text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                            {product.image && <span className="relative size-8 flex-none overflow-hidden rounded-lg"><Image src={product.image} alt="" fill className="object-cover" /></span>}
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{product.name}</span><span className="block text-[11px] text-muted-foreground">{product.views.toLocaleString()} views</span></span>
                            <span className="text-sm font-semibold tabular-nums text-brand-accent">{product.reachMomentum.toFixed(0)}</span>
                          </Link>
                        ))}
                      </HoverChaser>
                    </div>
                  )}

                  {reachData.topPulses.length > 0 && (
                    <div className={cn(settingsCard, 'p-4')}>
                      <CardTitle icon={FiMessageCircle}>Top pulses by momentum</CardTitle>
                      <HoverChaser className="space-y-0.5" boxClassName="rounded-xl">
                        {reachData.topPulses.map((pulse, i) => (
                          <Link key={pulse.id} href={`/pulse/${pulse.id}`} data-chase className="flex items-center gap-3 rounded-xl p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <span className="w-5 text-right text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{pulse.title || 'Untitled pulse'}</span><span className="block text-[11px] text-muted-foreground">{pulse.views.toLocaleString()} views</span></span>
                            <span className="text-sm font-semibold tabular-nums text-brand-accent">{pulse.reachMomentum.toFixed(0)}</span>
                          </Link>
                        ))}
                      </HoverChaser>
                    </div>
                  )}

                  <div className={cn(settingsCard, 'p-5')}>
                    <CardTitle icon={FiAward}>Reach badges &amp; milestones</CardTitle>
                    <ReachBadges badges={reachData.badges} />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center">
                  <FiTrendingUp className="mx-auto mb-3 size-10 text-muted-foreground/40" aria-hidden="true" />
                  <p className="text-muted-foreground">Reach analytics appear as the company gains engagement.</p>
                </div>
              )
            ) : (
              <TaxHelperDashboard companyId={companyId} />
            )}

            <div className={cn(settingsCard, 'p-5')}>
              <CardTitle>Quick actions</CardTitle>
              <HoverChaser className="grid grid-cols-2 gap-3 md:grid-cols-4" boxClassName="rounded-xl">
                {quickActions.map((action) => (
                  <Link key={action.label} href={action.href} data-chase className="flex flex-col items-start gap-2 rounded-xl border border-border/60 bg-foreground/[0.03] p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="grid size-9 place-items-center rounded-lg bg-brand-accent/10 text-brand-accent"><action.icon aria-hidden="true" className="size-4" /></span>
                    <span className="text-sm font-medium text-foreground">{action.label}</span>
                    <span className="text-xs text-muted-foreground">{action.description}</span>
                  </Link>
                ))}
              </HoverChaser>
            </div>
          </div>

          <div className="space-y-6">
            {reachData?.topEmployees && reachData.topEmployees.length > 0 && (
              <div className={cn(settingsCard, 'p-4')}>
                <CardTitle icon={FiZap}>Top contributors</CardTitle>
                <HoverChaser className="space-y-0.5" boxClassName="rounded-xl">
                  {reachData.topEmployees.map((emp, i) => (
                    <div key={emp.userId} data-chase className="flex items-center gap-3 rounded-xl p-2">
                      <span className="w-4 text-right text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                      <span className="relative size-8 flex-none overflow-hidden rounded-full ring-1 ring-border/60"><Image src={emp.image || '/users/avatar.webp'} alt="" fill className="object-cover" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{emp.name}</span><span className="block text-[11px] text-muted-foreground">{emp.role}</span></span>
                      <span className="text-right"><span className="block text-sm font-semibold tabular-nums text-brand-accent">{emp.reachMomentum.toFixed(0)}</span><span className="block text-[10px] text-muted-foreground">momentum</span></span>
                    </div>
                  ))}
                </HoverChaser>
              </div>
            )}

            <div className={cn(settingsCard, 'p-4')}>
              <div className="mb-3 flex items-center justify-between">
                <CardTitle icon={FiUsers}>Team</CardTitle>
                <span className="mb-3 text-xs tabular-nums text-muted-foreground">{company.employees.length} members</span>
              </div>
              <HoverChaser className="space-y-0.5" boxClassName="rounded-xl">
                {sortedEmployees.map((employee) => (
                  <div key={employee.id} data-chase className="flex items-center gap-3 rounded-xl p-2">
                    <span className="relative size-10 flex-none overflow-hidden rounded-full ring-1 ring-border/60"><Image src={employee.user.image || '/users/avatar.webp'} alt="" fill className="object-cover" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{employee.user.name}</span><span className="block truncate text-xs text-muted-foreground">{employee.jobTitle || employee.role}</span></span>
                    <StatusPill tone={roleTone(employee.role)}>{employee.role}</StatusPill>
                  </div>
                ))}
              </HoverChaser>
            </div>
          </div>
        </div>
      </div>
    </BannerThemeWrapper>
  );
}
