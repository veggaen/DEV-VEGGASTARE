import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { User } from '@prisma/client';

interface JobBoxProps {
  jobRequest: {
    id: string;
    title: string;
    user: User;
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
  };
}

const JobBox: React.FC<JobBoxProps> = ({ jobRequest }) => {
  if (!jobRequest) {
    return <div>No job request data available.</div>;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const diffMinutes = Math.floor((diff / 1000 / 60) % 60);
    const diffSeconds = Math.floor((diff / 1000) % 60);

    if (diffDays > 0) {
      return `posted ${diffDays} days ${diffHours} hours ago`;
    }
    if (diffHours > 0) {
      return `posted ${diffHours} hours ${diffMinutes} minutes ago`;
    }
    if (diffMinutes > 0) {
      return `posted ${diffMinutes} minutes ${diffSeconds} seconds ago`;
    }
    return `posted ${diffSeconds} seconds ago`;
  };

  return (
    <div className="job-box bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 m-4">
      <div className="w-full flex mb-2">
        <div className="user-details">
          <div className="flex items-center">
            {jobRequest.user.image && (
              <Image 
                src={jobRequest.user.image} 
                alt={jobRequest.user.name || 'User image'} 
                width={64} 
                height={64} 
                className="w-16 h-16 rounded-full mr-4" 
              />
            )}
            <div>
              <div className='flex gap-2'>
                {jobRequest.title && <h1>{jobRequest.title}</h1>}
                <Link href={`/nexus/company/job-box/${jobRequest.id}`} passHref>
                  <div className="text-md font-semibold underline underline-offset-3 decoration-white/50">{jobRequest.id}</div>
                </Link>
              </div>
              <div className="flex gap-2">
                {jobRequest.user.name && (
                  <p className="text-md font-bold">{jobRequest.user.name}</p>
                )}
                {jobRequest.createdAt && (
                  <p className="text-gray-500">{formatDate(jobRequest.createdAt)}</p>
                )}
              </div>
              {jobRequest.user.email && (
                <p className="text-sm text-gray-600">{jobRequest.user.email}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {jobRequest.descriptions.map((description, index) => (
        <div key={index} className="mb-4">
          <p className="text-lg font-semibold mb-2">{description}</p>
          {jobRequest.images[index] && (
            <div className="relative h-32 w-32 mb-2">
              <Image
                src={jobRequest.images[index] || ''}  // Fallback to an empty string if null
                alt={`Image ${index + 1}`}
                layout="fill"
                className="rounded object-cover"
              />
            </div>
          )}
        </div>
      ))}

      {jobRequest.links.length > 0 && jobRequest.links.some(link => link.trim() !== '') && (
        <div className="mb-4">
          <p className="text-lg font-semibold">Links:</p>
          {jobRequest.links.map((link, index) => (
            link.trim() !== '' && (
              <a
                key={index}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                {link}
              </a>
            )
          ))}
        </div>
      )}

      {jobRequest.docs.length > 0 && jobRequest.docs.some(doc => doc.trim() !== '') && (
        <div className="mb-4">
          <p className="text-lg font-semibold">Documents:</p>
          <p>
            {jobRequest.docs.map((doc, index) => (
              doc.trim() !== '' && (
                <a className="text-blue-500 hover:text-sky-500 hover:underline" key={index} href={doc} target="_blank" rel="noopener noreferrer">Document {index + 1}</a>
              )
            ))}
          </p>
        </div>
      )}

      {jobRequest.price && (
        <div className="mb-4">
          <p className="text-lg font-semibold">Price:</p>
          <p>{jobRequest.price}</p>
        </div>
      )}

      {jobRequest.price && jobRequest.negotiable !== null && (
        <div className="mb-4">
          <p className="text-lg font-semibold">Negotiable:</p>
          <p>{jobRequest.negotiable ? 'Yes' : 'No'}</p>
        </div>
      )}

      {jobRequest.paymentMethod && (
        <div className="mb-4">
          <p className="text-lg font-semibold">Payment Method:</p>
          <p>{jobRequest.paymentMethod}</p>
        </div>
      )}

      {jobRequest.delivery && (
        <div className="mb-4">
          <p className="text-lg font-semibold">Delivery:</p>
          <p>{jobRequest.delivery}</p>
        </div>
      )}

      {jobRequest.additionalNotes && (
        <div className="mb-4">
          <p className="text-lg font-semibold">Additional Notes:</p>
          <p>{jobRequest.additionalNotes}</p>
        </div>
      )}
    </div>
  );
};

export default JobBox;