'use client';

import { useEffect, useState } from 'react';
import { Company, Employee } from '@prisma/client'; // Assuming you have these types
import { useCurrentUser } from '@/hooks/use-current-user';
import Image from 'next/image';
import Link from 'next/link';
import DeleteCompanyBtn from './delete-company-btn';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';

const MyCompanies = () => {
  const user = useCurrentUser();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true); // Start true to show loading state initially
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/companies/filter-by-user-relation?userId=${user.id}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch companies');
        }
        const data = await response.json();
        setCompanies(data);

        // Extract permissions for the current user for each company
        const userPermissions = data.reduce((acc: Record<string, any>, company: any) => {
          const employee = company.employees.find((emp: any) => emp.userId === user.id);
          if (employee) {
            acc[company.id] = employee.permissions;
          }
          return acc;
        }, {});
        setPermissions(userPermissions);
      } catch (err) {
        console.error('Error fetching companies:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch companies');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [user]);

  const handleCompanyDeleted = (deletedCompanyId: string) => {
    setCompanies((prev) => prev.filter((company) => company.id !== deletedCompanyId));
  };

  const truncateDescription = (description: string) => {
    const maxLength = 200;
    return description.length > maxLength ? `${description.substring(0, maxLength)}...` : description;
  };

  if (loading) return <div>Loading companies...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!user) return <div>Please sign in to view your companies.</div>;
  if (!companies.length) return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-screen-2xl px-4 pb-10 pt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Companies</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              You don&apos;t have any companies yet. Create one to get started.
            </p>
          </div>
          <Link
            href="/companies/create"
            className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.07]"
          >
            Create company
          </Link>
        </div>
      </div>
    </div>
  );

  const ownedCompanies = user ? companies.filter((company: any) => company.ownerId === user.id) : companies;
  const memberCompanies = user
    ? companies.filter((company: any) => company.ownerId !== user.id && company.employees?.some((emp: any) => emp.userId === user.id))
    : [];
  const createdCompanies = user
    ? companies.filter((company: any) => company.creatorId === user.id && company.ownerId !== user.id && !company.employees?.some((emp: any) => emp.userId === user.id))
    : [];

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-screen-2xl px-4 pb-10 pt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Companies</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Manage your organizations and jump into inventory.
            </p>
          </div>

          <Link
            href="/companies/create"
            className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.07]"
          >
            Create company
          </Link>
        </div>

      {ownedCompanies.length > 0 && (
        <div className="mb-8">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Owned by you</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {ownedCompanies.map((company: any) => (
              <div
                key={company.id}
                className="group flex h-full flex-col border border-black/10 bg-white/40 backdrop-blur-sm transition-[border-radius,box-shadow,background-color] duration-200 hover:bg-white/60 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] rounded-lg hover:rounded-2xl"
              >
                <div className="p-3">
                  <AspectRatio ratio={1 / 1}>
                    <Link href={`/companies/${company.id}`} passHref>
                      <Image
                        src={company.logo?.[0] || "/users/avatar.webp"}
                        alt={`${company.name} logo`}
                        fill={true}
                        objectFit="cover"
                        className="dark:brightness-90 rounded-md transition-[border-radius] duration-200 group-hover:rounded-xl"
                      />
                    </Link>
                  </AspectRatio>
                </div>

                <div className="flex flex-1 flex-col px-4 pb-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {company.name}
                    </h3>
                    {company.orgType ? (
                      <div className="mt-1">
                        <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200">
                          {company.orgType}
                        </span>
                      </div>
                    ) : null}
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 line-clamp-3">
                      {company.description ? truncateDescription(company.description) : ""}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Link href={`/companies/${company.id}`} passHref className="w-full">
                      <Button variant='vegaNormalBtn' className="bg-black/10 dark:bg-black/10 font-semibold w-full">
                        View
                      </Button>
                    </Link>
                    {permissions[company.id] && permissions[company.id].CAN_DELETE_COMPANY && (
                      <DeleteCompanyBtn
                        companyId={company.id}
                        companyName={company.name}
                        onCompanyDeleted={() => handleCompanyDeleted(company.id)}
                        employeePermissions={permissions[company.id]}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {memberCompanies.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">You’re a member</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {memberCompanies.map((company: any) => (
              <div
                key={company.id}
                className="group flex h-full flex-col border border-black/10 bg-white/40 backdrop-blur-sm transition-[border-radius,box-shadow,background-color] duration-200 hover:bg-white/60 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] rounded-lg hover:rounded-2xl"
              >
                <div className="p-3">
                  <AspectRatio ratio={1 / 1}>
                    <Link href={`/companies/${company.id}`} passHref>
                      <Image
                        src={company.logo?.[0] || "/users/avatar.webp"}
                        alt={`${company.name} logo`}
                        fill={true}
                        objectFit="cover"
                        className="dark:brightness-90 rounded-md transition-[border-radius] duration-200 group-hover:rounded-xl"
                      />
                    </Link>
                  </AspectRatio>
                </div>

                <div className="flex flex-1 flex-col px-4 pb-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {company.name}
                    </h3>
                    {company.orgType ? (
                      <div className="mt-1">
                        <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200">
                          {company.orgType}
                        </span>
                      </div>
                    ) : null}
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 line-clamp-3">
                      {company.description ? truncateDescription(company.description) : ""}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Link href={`/companies/${company.id}`} passHref className="w-full">
                      <Button variant='vegaNormalBtn' className="bg-black/10 dark:bg-black/10 font-semibold w-full">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {createdCompanies.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Created by you</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {createdCompanies.map((company: any) => (
              <div
                key={company.id}
                className="group flex h-full flex-col border border-black/10 bg-white/40 backdrop-blur-sm transition-[border-radius,box-shadow,background-color] duration-200 hover:bg-white/60 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] rounded-lg hover:rounded-2xl"
              >
                <div className="p-3">
                  <AspectRatio ratio={1 / 1}>
                    <Link href={`/companies/${company.id}`} passHref>
                      <Image
                        src={company.logo?.[0] || "/users/avatar.webp"}
                        alt={`${company.name} logo`}
                        fill={true}
                        objectFit="cover"
                        className="dark:brightness-90 rounded-md transition-[border-radius] duration-200 group-hover:rounded-xl"
                      />
                    </Link>
                  </AspectRatio>
                </div>

                <div className="flex flex-1 flex-col px-4 pb-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {company.name}
                    </h3>
                    {company.orgType ? (
                      <div className="mt-1">
                        <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200">
                          {company.orgType}
                        </span>
                      </div>
                    ) : null}
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 line-clamp-3">
                      {company.description ? truncateDescription(company.description) : ""}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Link href={`/companies/${company.id}`} passHref className="w-full">
                      <Button variant='vegaNormalBtn' className="bg-black/10 dark:bg-black/10 font-semibold w-full">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default MyCompanies;
