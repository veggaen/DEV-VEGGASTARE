import React from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';

interface JobBoxProps {
  jobRequest: {
    id: string;
    descriptions: string[];
    images: string[];
    links: string[];
    docs: string[];
    price?: string; // Optional
    negotiable?: boolean; // Optional
    paymentMethod?: string; // Optional
    delivery?: string; // Optional
    additionalNotes?: string; // Optional
    createdAt: string; // ISO string
  };
}

const JobBox: React.FC<JobBoxProps> = ({ jobRequest }) => {
  if (!jobRequest) {
    return <div>No job request data available.</div>;
  }

  const timeAgo = formatDistanceToNow(new Date(jobRequest.createdAt), { addSuffix: true });

  // Filter out empty strings from links and docs
  const filteredLinks = jobRequest.links.filter(link => link.trim() !== '');
  const filteredDocs = jobRequest.docs.filter(doc => doc.trim() !== '');

  return (
    <div className="job-box bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 m-4">
      <h1 className="text-md font-semibold underline underline-offset-3">Work ID: {jobRequest.id}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">Posted {timeAgo}</p>
      {jobRequest.descriptions.map((description, index) => (
        <div key={index} className="mb-4">
          <p className="text-lg font-semibold mb-2">{description}</p>
          {jobRequest.images[index] && (
            <div className="relative h-32 w-32 mb-2">
              <Image
                src={jobRequest.images[index]}
                alt={`Image ${index + 1}`}
                fill
                className="rounded object-cover"
              />
            </div>
          )}
        </div>
      ))}
      {filteredLinks.length > 0 && (
        <div className="mb-4">
          <p className="text-lg font-semibold">Links:</p>
          {filteredLinks.map((link, index) => (
            <a
              key={index}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {link}
            </a>
          ))}
        </div>
      )}
      {filteredDocs.length > 0 && (
        <div className="mb-4">
          <p className="text-lg font-semibold">Documents:</p>
          <p>
            {filteredDocs.map((doc, index) => (
              <a className="text-blue-500 hover:text-sky-500 hover:underline" key={index} href={doc} target="_blank" rel="noopener noreferrer">Document {index + 1}</a>
            ))}
          </p>
        </div>
      )}
      {jobRequest.price && (
        <>
          <div className="mb-4">
            <p className="text-lg font-semibold">Price:</p>
            <p>{jobRequest.price}</p>
          </div>
          <div className="mb-4">
            <p className="text-lg font-semibold">Negotiable:</p>
            <p>{jobRequest.negotiable ? 'Yes' : 'No'}</p>
          </div>
        </>
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