'use client';

/** @fileOverview The company directory: your own companies first, then everyone else's storefronts, as trailing-box card grids. @stability evolving */

import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { isDemoUserId } from '@/lib/demo-policy';
import { CompaniesPublicResponseSchema, CompaniesByUserRelationResponseSchema } from '@/lib/types/company';
import { FiArrowRight, FiBriefcase, FiGlobe, FiHome, FiPlus, FiUsers } from 'react-icons/fi';
import { PageHeader } from '@/components/uicustom/chrome/page-header';
import { HoverChaser } from '@/components/uicustom/chrome/hover-chaser';
import { StatusPill } from '@/components/uicustom/settings/settings-primitives';

interface PublicCompany {
  id: string;
  name: string;
  description?: string | null;
  logo: string[] | null;
  bannerImage: string[] | null;
  orgType?: string | null;
  createdAt: string;
  ownerId?: string;
  creatorId?: string;
  creator?: { id: string; name: string | null };
  employees?: Array<{ userId: string; role?: string }>;
  _count?: { employees: number };
}

const CompanyCard = ({ company }: { company: PublicCompany }) => {
  const createdAtDate = new Date(company.createdAt);
  const foundedLabel = Number.isNaN(createdAtDate.getTime()) ? 'Founded recently' : `Founded ${formatDistanceToNow(createdAtDate, { addSuffix: true })}`;
  const memberCount = typeof company._count?.employees === 'number' ? company._count.employees : Array.isArray(company.employees) ? company.employees.length : 0;

  return (
    <Link
      href={`/companies/${company.id}`}
      data-chase
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/70 text-card-foreground shadow-e1 backdrop-blur-xl transition-[transform,border-color] duration-200 motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative h-20 w-full">
        {company.bannerImage?.[0] ? (
          <Image src={company.bannerImage[0]} alt="" fill sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 50vw, 320px" className="object-cover" />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(135deg,hsl(var(--brand-accent)/0.35),hsl(var(--brand-accent)/0.08)_55%,hsl(var(--muted)))]" />
        )}
        <div className="absolute -bottom-6 left-3">
          <div className="relative size-12 overflow-hidden rounded-xl border-2 border-card bg-card shadow-e1">
            <Image src={company.logo?.[0] || '/users/avatar.webp'} alt="" fill sizes="48px" className="object-cover" />
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-8">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{company.name}</h3>
          {company.orgType && <StatusPill className="mt-1">{company.orgType}</StatusPill>}
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{company.description || 'No description yet.'}</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><FiUsers aria-hidden="true" className="size-3" />{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          <span>{foundedLabel}</span>
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-brand-accent">Open storefront <FiArrowRight aria-hidden="true" className="size-3.5" /></span>
      </div>
    </Link>
  );
};

const CompanySection = ({ title, description, icon: Icon, companies, emptyMessage }: { title: string; description?: string; icon: React.ElementType; companies: PublicCompany[]; emptyMessage?: string }) => {
  if (companies.length === 0 && !emptyMessage) return null;
  return (
    <section aria-label={title} className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"><Icon aria-hidden="true" className="size-3.5 text-brand-accent" />{title}<span className="tabular-nums">· {companies.length}</span></h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {companies.length === 0 && emptyMessage ? (
        <p className="rounded-2xl border border-dashed border-border/70 px-5 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <HoverChaser className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" boxClassName="rounded-2xl">
          {companies.map((company) => <CompanyCard key={company.id} company={company} />)}
        </HoverChaser>
      )}
    </section>
  );
};

const AllCompanies = () => {
  const { user: currentUser, isLoading: sessionLoading } = useCurrentUserWithStatus();
  const isDemo = isDemoUserId(currentUser?.id);
  // Independent keys: resolving auth must not refetch/hide the public directory.
  const publicQuery = useSWR('/api/companies/public', async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Company directory unavailable');
    return CompaniesPublicResponseSchema.parse(await response.json());
  }, { revalidateOnFocus: false, shouldRetryOnError: false });
  const relatedQuery = useSWR(currentUser?.id && !isDemo ? ['/api/companies/filter-by-user-relation', currentUser.id] : null,
    async ([url]: [string, string]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Your companies are unavailable');
      return CompaniesByUserRelationResponseSchema.parse(await response.json());
    }, { revalidateOnFocus: false, shouldRetryOnError: false });
  const allCompanies = publicQuery.data ?? [];
  const userCompanies = relatedQuery.data ?? [];

  const ownedCompanies = currentUser ? userCompanies.filter((c) => c.ownerId === currentUser.id) : [];
  const employedCompanies = currentUser ? userCompanies.filter((c) => c.ownerId !== currentUser.id && c.employees?.some((emp) => emp.userId === currentUser.id)) : [];
  const userCompanyIds = new Set(userCompanies.map((c) => c.id));
  const otherCompanies = allCompanies.filter((c) => !userCompanyIds.has(c.id));
  const hasNoCompanyRelation = currentUser && !isDemo && relatedQuery.data && userCompanies.length === 0;

  return (
    <div className="w-full">
      <div data-company-directory className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Directory"
          title="Companies"
          description="Independent businesses selling and hiring on Veggat. Open a storefront to browse products, or run your own with a team."
          actions={<Button asChild variant="vegaEmeraldBtn" className="min-h-11 gap-2"><Link href="/companies/create"><FiPlus aria-hidden="true" className="size-4" />{isDemo ? 'Company setup preview' : 'Create company'}</Link></Button>}
          className="mb-8"
        />

        {isDemo && <p className="mb-6 rounded-2xl border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground">Demo preview: explore storefronts below. Company creation and team changes require your own account.</p>}
        {(sessionLoading || relatedQuery.isLoading) && <p role="status" className="mb-6 text-sm text-muted-foreground">Checking your workspace…</p>}
        {relatedQuery.error && <div role="alert" className="mb-6 rounded-2xl border border-border/60 bg-card/70 p-4 text-sm">Your organizations could not be loaded. Public storefronts are still available. <Button variant="vegaNormalBtn" className="mt-2 min-h-11" onClick={() => void relatedQuery.mutate()}>Retry your companies</Button></div>}

        {hasNoCompanyRelation && (
          <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-brand-accent/30 bg-brand-accent/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-accent/15 text-brand-accent"><FiHome aria-hidden="true" className="size-5" /></span>
              <div>
                <h3 className="text-base font-semibold text-foreground">Start your business here</h3>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">You do not own or work at a company yet. Create one to list products, receive requests from the job board and manage a team, or explore the storefronts below.</p>
              </div>
            </div>
            <Button asChild variant="vegaEmeraldBtn" className="min-h-11 shrink-0 gap-2"><Link href="/companies/create"><FiPlus aria-hidden="true" className="size-4" />Create your first company</Link></Button>
          </div>
        )}

        {currentUser && (
          <>
            <CompanySection title="Companies you own" description="Storefronts, team and payouts you control." icon={FiBriefcase} companies={ownedCompanies} />
            <CompanySection title="Companies you work at" icon={FiUsers} companies={employedCompanies} />
          </>
        )}

        {publicQuery.isLoading && <div role="status" aria-label="Loading company directory" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} aria-hidden="true" className="h-64 rounded-2xl border border-border/60 bg-muted motion-safe:animate-pulse" style={{ opacity: 1 - index * 0.18 }} />)}
        </div>}
        {publicQuery.error && <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <p>We couldn’t load the company directory. Please try again.</p>
          <Button variant="vegaNormalBtn" className="mt-3 min-h-11" onClick={() => void publicQuery.mutate()}>Retry directory</Button>
        </div>}
        {publicQuery.data && <CompanySection
          title={currentUser ? 'Other companies' : 'All companies'}
          description="Every storefront on Veggat, newest first."
          icon={FiGlobe}
          companies={currentUser ? otherCompanies : allCompanies}
          emptyMessage={allCompanies.length === 0 ? 'No companies have been created yet.' : undefined}
        />}
      </div>
    </div>
  );
};

export default AllCompanies;
