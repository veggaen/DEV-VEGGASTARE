'use client'

import { useEffect, useState } from 'react';
import { Company, Employee } from '@prisma/client'; // Assuming you have these types
import { useCurrentUser } from '@/hooks/use-current-user';
import Image from 'next/image';
import Link from 'next/link';

const MyCompanies = () => {
  const user = useCurrentUser();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const response = await fetch(`/api/companies?userId=${user.id}`);
        if (!response.ok) throw new Error('Failed to fetch companies');
        const data = await response.json();
        setCompanies(data);
      } catch (error) {
        console.error('Error fetching companies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [user]);

  if (loading) return <div>Loading companies...</div>;
  if (!companies.length) return <div>No companies found.</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold dark:text-white mb-4">My Companies</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {companies.map((company) => (
          <div key={company.id} className="border dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="relative w-full h-60">
              {/* Example Image URL, replace as needed */}
              
              <Image src={ company.logo[0] } alt={`${company.name} logo`} layout="fill" objectFit="cover" className="dark:brightness-75" />
            </div>
            <div className="p-4 bg-white dark:bg-gray-800">
              <h3 className="text-lg font-bold dark:text-white">{company.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{company.description}</p>
              <Link href={`/settings/company/${company.id}`} passHref>
                <div className="inline-block mt-2 text-blue-500 hover:text-blue-700 dark:hover:text-blue-400">View Details</div>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


export default MyCompanies;