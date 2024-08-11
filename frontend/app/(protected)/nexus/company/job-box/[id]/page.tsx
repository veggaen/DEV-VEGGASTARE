'use client';

import React, { useEffect, useState } from 'react';
import JobBox from '@/components/uicustom/job-components/jobboxen';
import { useParams } from 'next/navigation';
import { User } from '@prisma/client';

interface JobRequest {
  id: string;
  title: string;
  descriptions: string[];
  images: string[];
  links: string[];
  docs: string[];
  price: string | null;
  negotiable: boolean | null;
  paymentMethod: string | null;
  delivery: string | null;
  additionalNotes: string | null;
  createdAt: string;
  user: User; // Add user details here
}

const JobBoxDetailPage: React.FC = () => {
  const params = useParams();
  const { id } = params;
  console.log(`JobBoxDetailPage: id=${id}`);
  const [jobRequest, setJobRequest] = useState<JobRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const fetchJobRequest = async () => {
        try {
          const response = await fetch(`/api/job-requests/${id}`);
          if (!response.ok) {
            throw new Error('Failed to fetch job request');
          }
          const data = await response.json();
          setJobRequest(data);
        } catch (error) {
          console.error('Error fetching job request:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchJobRequest();
    }
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!jobRequest) {
    return <div>Job request not found.</div>;
  }

  return (
    <div className='w-full'>
      <JobBox jobRequest={jobRequest} />
    </div>
  );
};

export default JobBoxDetailPage;