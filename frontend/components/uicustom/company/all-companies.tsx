'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useCurrentUser } from '@/hooks/use-current-user';
import { FiPlus, FiBriefcase, FiUsers, FiGlobe, FiHome } from 'react-icons/fi';

interface PublicCompany {
  id: string;
  name: string;
  description: string | null;
  logo: string[] | null;
  bannerImage: string[] | null;
  orgType: string | null;
  createdAt: string;
  ownerId?: string;
  creatorId?: string;
  creator: {
    id: string;
    name: string | null;
  };
  employees?: Array<{
    userId: string;
    role?: string;
  }>;
  _count: {
    employees: number;
  };
}

const truncateDescription = (description: string | null) => {
  if (!description) return '';
  const maxLength = 120;
  return description.length > maxLength ? `${description.substring(0, maxLength)}...` : description;
};

const CompanyCard = ({ company }: { company: PublicCompany }) => {
  return (
    <Link
      href={`/companies/${company.id}`}
      className="group flex h-full flex-col border border-black/10 bg-white/40 backdrop-blur-sm transition-[border-radius,box-shadow,background-color] duration-200 hover:bg-white/60 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] rounded-lg hover:rounded-2xl overflow-hidden"
    >
      {/* Banner or gradient header */}
      <div className="relative h-20 w-full">
        {company.bannerImage?.[0] ? (
          <Image
            src={company.bannerImage[0]}
            alt={`${company.name} banner`}
            fill
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

        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>{company._count.employees} {company._count.employees === 1 ? 'member' : 'members'}</span>
          <span>Founded {formatDistanceToNow(new Date(company.createdAt), { addSuffix: true })}</span>
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
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">({companies.length})</span>
      </div>
      {companies.length === 0 && emptyMessage ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}
    </div>
  );
};

const AllCompanies = () => {
  const currentUser = useCurrentUser();
  const [allCompanies, setAllCompanies] = useState<PublicCompany[]>([]);
  const [userCompanies, setUserCompanies] = useState<PublicCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all public companies
        const publicResponse = await fetch('/api/companies/public');
        if (!publicResponse.ok) {
          throw new Error('Failed to fetch companies');
        }
        const publicData = await publicResponse.json();
        setAllCompanies(publicData);

        // If user is logged in, fetch their related companies
        if (currentUser?.id) {
          const userResponse = await fetch(`/api/companies/filter-by-user-relation?userId=${currentUser.id}`);
          if (userResponse.ok) {
            const userData = await userResponse.json();
            setUserCompanies(userData);
          }
        }
      } catch (err) {
        console.error('Error fetching companies:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch companies');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [currentUser?.id]);

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

  const hasNoCompanyRelation = currentUser && ownedCompanies.length === 0 && employedCompanies.length === 0;

  if (loading) {
    return (
      <div className="w-full">
        <div className="mx-auto w-full max-w-screen-2xl px-4 pb-10 pt-6">
          <div className="animate-pulse">
            <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-48 mb-4"></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="mx-auto w-full max-w-screen-2xl px-4 pb-10 pt-6">
          <div className="text-red-500">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-screen-2xl px-4 pb-10 pt-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              {currentUser ? 'Companies' : 'Company Directory'}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {currentUser 
                ? 'Manage your organizations and discover new businesses.'
                : 'Discover companies and browse their storefronts.'}
            </p>
          </div>
          <Link
            href="/companies/create"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 bg-black/5 px-4 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.07]"
          >
            <FiPlus className="h-4 w-4" />
            Create company
          </Link>
        </div>

        {/* Empty state for users with no company relations */}
        {hasNoCompanyRelation && (
          <div className="mb-10 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30 p-8 text-center">
            <FiHome className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500 mb-4" />
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
        <CompanySection
          title={currentUser ? "Other Companies" : "All Companies"}
          icon={FiGlobe}
          companies={currentUser ? otherCompanies : allCompanies}
          emptyMessage={allCompanies.length === 0 ? "No companies have been created yet." : undefined}
        />
      </div>
    </div>
  );
};

export default AllCompanies;
