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
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const response = await fetch(`/api/companies?userId=${user.id}`);
        if (!response.ok) throw new Error('Failed to fetch companies');
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
      } catch (error) {
        console.error('Error fetching companies:', error);
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
  if (!companies.length) return <div>No companies found.</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold dark:text-white mb-4">My Companies</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {companies.map((company) => (
          <div key={company.id} className="group flex flex-col hover:shadow-lg transition-shadow duration-300 hover:bg-blue-500/30 py-4 px-2">
            <div className="rounded-t-lg">
              <AspectRatio ratio={1 / 1}>
                <Link href={`/settings/company/${company.id}`} passHref>
                  <Image src={company.logo[0]} alt={`${company.name} logo`} layout="fill" objectFit="cover" className="dark:brightness-75 rounded" />
                </Link>
              </AspectRatio>
            </div>
            <div className="flex flex-col justify-between h-full p-4">
              <div className='flex-grow mb-3'>
                <h3 className="text-lg font-bold dark:text-indigo-400 text-indigo-600 text-pretty pb-2">{company.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-pretty p-2  h-fit">{truncateDescription(company.description)}</p>
              </div>
              <div className="flex justify-between items-center">
                <Link href={`/settings/company/${company.id}`} passHref>
                  <Button variant='vegaNormalBtn' className="bg-black/10 dark:bg-black/10 font-semibold">View Company</Button>
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
  );
};

export default MyCompanies;