'use client';

import JobBox from '@/components/uicustom/job-components/jobboxen';
import { User } from '@prisma/client';
import React, { useEffect, useState } from 'react';

interface JobRequest {
  id: string;
  title: string; 
  user: User;
  descriptions: string[];
  images: string[];
  links: string[];
  docs: string[];
  price: string;
  negotiable: boolean;
  paymentMethod: string;
  delivery: string;
  additionalNotes: string;
  createdAt: string; // Add createdAt to the JobRequest interface
}

const JobBoxPage: React.FC = () => {
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOption, setSortOption] = useState('newest');
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    const fetchJobRequests = async () => {
      try {
        const response = await fetch('/api/job-requests');
        if (!response.ok) {
          throw new Error('Failed to fetch job requests');
        }
        const data = await response.json();
        setJobRequests(data);
      } catch (error) {
        console.error('Error fetching job requests:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobRequests();
  }, []);

  const sortJobRequests = (requests: JobRequest[]) => {
    return requests.sort((a, b) => {
      if (sortOption === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortOption === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return 0;
    });
  };

  const filterJobRequests = (requests: JobRequest[]) => {
    return requests.filter((request) => {
      const matchesText = request.descriptions.some(description =>
        description.toLowerCase().includes(filterText.toLowerCase())
      ) || request.additionalNotes.toLowerCase().includes(filterText.toLowerCase()) ||
        request.paymentMethod.toLowerCase().includes(filterText.toLowerCase());

      return matchesText;
    });
  };

  const sortedAndFilteredRequests = filterJobRequests(sortJobRequests(jobRequests));

  if (loading) {
    return <div>Loading...</div>;
  }

  if (jobRequests.length === 0) {
    return <div>No job requests available.</div>;
  }

  return (
    <div className='w-full'>
      <div className="flex justify-between items-center px-4 pb-4 w-full">
        <div className=''>
          <select
            id="sort"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="p-2 border bg-gray-300/50 border-gray-500/10 dark:bg-slate-600 dark:border-slate-700 text-black/80 hover:text-black dark:text-white/80 hover:dark:text-white hover:placeholder-gray-800/70 transition duration-300 ease-in-out hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 focus:outline outline-sky-500 active:border active:border-sky-500 hover:bg-sky-400 dark:hover:bg-sky-700"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
        <div className=''>
          <input
            id="filter-text"
            type="text"
            value={filterText}
            placeholder='Search...'
            onChange={(e) => setFilterText(e.target.value)}
            className="p-2 border bg-gray-300/50 border-gray-500/10 dark:bg-slate-600 dark:border-slate-700 text-black/80 hover:text-black dark:text-white/80 hover:dark:text-white hover:placeholder-gray-800/70 dark:hover:placeholder-gray-200/80 transition duration-300 ease-in-out hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 focus:outline outline-sky-500 active:border active:border-sky-500 hover:bg-sky-400 dark:hover:bg-sky-700"
          />
        </div>
      </div>
      {sortedAndFilteredRequests.map((jobRequest, index) => (
        <JobBox key={index} jobRequest={jobRequest} />
      ))}
    </div>
  );
};

export default JobBoxPage;