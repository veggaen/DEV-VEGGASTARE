'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface PublicCompany {
  id: string;
  name: string;
  description: string | null;
  logo: string[] | null;
  bannerImage: string[] | null;
  orgType: string | null;
  createdAt: string;
  creator: {
    id: string;
    name: string | null;
  };
  _count: {
    employees: number;
  };
}

const AllCompanies = () => {
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/companies/public');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch companies');
        }
        const data = await response.json();
        setCompanies(data);
      } catch (err) {
        console.error('Error fetching companies:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch companies');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  const truncateDescription = (description: string | null) => {
    if (!description) return '';
    const maxLength = 120;
    return description.length > maxLength ? `${description.substring(0, maxLength)}...` : description;
  };

  if (loading) {
    return (
      <div className="w-full">
        <div className="mx-auto w-full max-w-screen-2xl px-4 pb-10 pt-6">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-48 mb-4"></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-64 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Company Directory</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Discover companies and browse their storefronts.
            </p>
          </div>
          <Link
            href="/companies/create"
            className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.07]"
          >
            Create company
          </Link>
        </div>

        {companies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-300">No companies have been created yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {companies.map((company) => (
              <Link
                key={company.id}
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
                    <div className="h-full w-full bg-gradient-to-r from-indigo-500/30 via-sky-500/20 to-emerald-500/30 dark:from-indigo-500/20 dark:via-sky-500/10 dark:to-emerald-500/20" />
                  )}
                  {/* Logo overlay */}
                  <div className="absolute -bottom-6 left-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-lg border-2 border-white dark:border-slate-900 bg-white dark:bg-slate-900">
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
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {company.name}
                    </h3>
                    {company.orgType && (
                      <div className="mt-1">
                        <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
                          {company.orgType}
                        </span>
                      </div>
                    )}
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                      {truncateDescription(company.description)}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{company._count.employees} {company._count.employees === 1 ? 'member' : 'members'}</span>
                    <span>Founded {formatDistanceToNow(new Date(company.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AllCompanies;
