'use client'
import JobBox from '@/components/uicustom/job-components/jobboxen';
import React, { useEffect, useState } from 'react';

interface JobRequest {
  descriptions: string[];
  images: string[];
  links: string[];
  docs: string[];
  price: string;
  negotiable: boolean;
  paymentMethod: string;
  delivery: string;
  additionalNotes: string;
}

const JobBoxPage: React.FC = () => {
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div>Loading...</div>;
  }

  if (jobRequests.length === 0) {
    return <div>No job requests available.</div>;
  }

  return (
    <div>
      {jobRequests.map((jobRequest, index) => (
        <JobBox key={index} jobRequest={jobRequest} />
      ))}
    </div>
  );
};

export default JobBoxPage;