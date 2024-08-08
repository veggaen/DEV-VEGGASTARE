'use client';

import JobBox from '@/components/uicustom/job-components/jobboxen';
import React, { useEffect, useState } from 'react';

interface JobRequest {
  id: string;
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
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <label htmlFor="sort" className="mr-2">Sort by:</label>
          <select
            id="sort"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
        <div>
          <label htmlFor="filter-text" className="mr-2">Filter by text:</label>
          <input
            id="filter-text"
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="border p-2 rounded"
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