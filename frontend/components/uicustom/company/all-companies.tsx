'use client';

import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { isDemoUserId } from '@/lib/demo-policy';
import { CompaniesPublicResponseSchema, CompaniesByUserRelationResponseSchema } from '@/lib/types/company';
import { FiPlus, FiBriefcase, FiUsers, FiGlobe, FiHome } from 'react-icons/fi';

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
  creator?: {
    id: string;
    name: string | null;
  };
  employees?: Array<{
    userId: string;
    role?: string;
  }>;
  _count?: {
    employees: number;
  };
}

const truncateDescription = (description?: string | null) => {
  if (!description) return '';
  const maxLength = 120;
  return description.length > maxLength ? `${description.substring(0, maxLength)}...` : description;
};

const CompanyCard = ({ company }: { company: PublicCompany }) => {
  const createdAtDate = new Date(company.createdAt);
  const foundedLabel = Number.isNaN(createdAtDate.getTime())
    ? 'Founded recently'
    : `Founded ${formatDistanceToNow(createdAtDate, { addSuffix: true })}`;
  const memberCount =
    typeof company._count?.employees === 'number'
      ? company._count.employees
      : Array.isArray(company.employees)
      ? company.employees.length
      : 0;

  return (
    <Link
      href={`/companies/${company.id}`}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Banner or gradient header */}
      <div className="relative h-20 w-full">
        {company.bannerImage?.[0] ? (
          <Image
            src={company.bannerImage[0]}
            alt={`${company.name} banner`}
            fill
            sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 50vw, 320px"
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-linear-to-r from-indigo-500/30 via-sky-500/20 to-emerald-500/30 dark:from-indigo-500/20 dark:via-sky-500/10 dark:to-emerald-500/20" />
        )}
        {/* Logo overlay */}
        <div className="absolute -bottom-6 left-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-lg border-2 border-white dark:border-zinc-900 bg-white dark:bg-zinc-900">
            <Image
              src={company.logo?.[0] || "/users/avatar.webp"}
              alt={`${company.name} logo`}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-8">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {company.name}
          </h3>
          {company.orgType && (
            <div className="mt-1">
              <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200">
                {company.orgType}
              </span>
            </div>
          )}
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2">
            {truncateDescription(company.description)}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          <span>{foundedLabel}</span>
        </div>
      </div>
    </Link>
  );
};

const CompanySection = ({ 
  title, 
  icon: Icon, 
  companies, 
  emptyMessage 
}: { 
  title: string; 
  icon: React.ElementType;
  companies: PublicCompany[]; 
  emptyMessage?: string;
}) => {
  if (companies.length === 0 && !emptyMessage) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">({companies.length})</span>
      </div>
      {companies.length === 0 && emptyMessage ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}
    </div>
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

  // Categorize companies
  const ownedCompanies = currentUser 
    ? userCompanies.filter((c) => c.ownerId === currentUser.id)
    : [];
  
  const employedCompanies = currentUser
    ? userCompanies.filter((c) => 
        c.ownerId !== currentUser.id && 
        c.employees?.some((emp) => emp.userId === currentUser.id)
      )
    : [];
  
  // Get IDs of user's companies to filter them out from "other companies"
  const userCompanyIds = new Set(userCompanies.map((c) => c.id));
  const otherCompanies = allCompanies.filter((c) => !userCompanyIds.has(c.id));

  const hasNoCompanyRelation = currentUser && !isDemo && relatedQuery.data && userCompanies.length === 0;

  return (
    <div className="w-full">
      <div data-company-directory className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Companies</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Discover independent businesses and browse their products.
            </p>
          </div>
          <Link
            href="/companies/create"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FiPlus className="h-4 w-4" />
            {isDemo ? 'Company setup preview' : 'Create company'}
          </Link>
        </div>

        {isDemo && <p className="mb-6 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">Demo preview: explore storefronts below. Company creation and team changes require your own account.</p>}
        {(sessionLoading || relatedQuery.isLoading) && <p role="status" className="mb-6 text-sm text-muted-foreground">Checking your workspace…</p>}
        {relatedQuery.error && <div role="alert" className="mb-6 rounded-xl border border-border p-4 text-sm">Your organizations could not be loaded. Public storefronts are still available. <Button variant="outline" className="mt-2 min-h-11" onClick={() => void relatedQuery.mutate()}>Retry your companies</Button></div>}
        {/* Compact onboarding leaves actual companies visible on phones. */}
        {hasNoCompanyRelation && (
          <div className="mb-6 rounded-xl border border-border bg-muted/30 p-4 sm:p-6">
            <FiHome aria-hidden="true" className="h-6 w-6 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Start Your Business Journey
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 max-w-md mx-auto">
              You don&apos;t own or work at any company yet. Create your own company to start selling products, or explore companies below to find opportunities.
            </p>
            <Link
              href="/companies/create"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <FiPlus className="h-4 w-4" />
              Create Your First Company
            </Link>
          </div>
        )}

        {/* User's Companies Section - Only show if logged in */}
        {currentUser && (
          <>
            {/* Companies You Own */}
            <CompanySection
              title="Companies You Own"
              icon={FiBriefcase}
              companies={ownedCompanies}
            />

            {/* Companies You Work At */}
            <CompanySection
              title="Companies You Work At"
              icon={FiUsers}
              companies={employedCompanies}
            />
          </>
        )}

        {/* Other/All Companies */}
        {publicQuery.isLoading && <div role="status" aria-label="Loading company directory" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} aria-hidden="true" className="h-64 rounded-xl border border-border bg-muted motion-safe:animate-pulse" />)}
        </div>}
        {publicQuery.error && <div role="alert" className="rounded-xl border border-border p-5">
          <p>We couldn’t load the company directory. Please try again.</p>
          <Button variant="outline" className="mt-3 min-h-11" onClick={() => void publicQuery.mutate()}>Retry directory</Button>
        </div>}
        {publicQuery.data && <CompanySection
          title={currentUser ? "Other Companies" : "All Companies"}
          icon={FiGlobe}
          companies={currentUser ? otherCompanies : allCompanies}
          emptyMessage={allCompanies.length === 0 ? "No companies have been created yet." : undefined}
        />}
      </div>
    </div>
  );
};

export default AllCompanies;
