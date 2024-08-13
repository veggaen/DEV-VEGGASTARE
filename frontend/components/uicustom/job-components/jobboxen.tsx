import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation'
import { AspectRatio } from '@/components/ui/aspect-ratio';
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
      return `${diffDays} days ${diffHours} hours ago`;
    }
    if (diffHours > 0) {
      return `${diffHours} hours ${diffMinutes} min ago`;
    }
    if (diffMinutes > 0) {
      return `${diffMinutes} min ${diffSeconds} sec ago`;
    }
    return `${diffSeconds} sec ago`;
  };
  const pathname = usePathname()

  return (
    <div className="job-box bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 m-4">
      <div className="w-full xl:relative flex justify-center flex-col xl:flex-row-reverse">
        <div className='flex justify-center items-center xl:h-[72px] mb-2 md:mb-0'>
          {jobRequest.title && 
            <Link href={`/nexus/company/job-box/${jobRequest.id}`} passHref>
              <h1 className='text-2xl font-bold text-indigo-300 underline decoration-indigo-300/50 overflow-hidden'>{jobRequest.title}</h1>
            </Link>
          }
          {!jobRequest.title && <Link href={`/nexus/company/job-box/${jobRequest.id}`} passHref>
            <div className="text-xl font-bold text-indigo-300 underline decoration-indigo-300/50">{jobRequest.id}</div>
          </Link>}
        </div>
        {pathname.includes(`${jobRequest.id}`) && (
          <div className={`user-details xl:absolute xl:left-0 mb-4 `}>
            <div className="flex items-start">
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
                
                <div className="flex gap-2">
                  {jobRequest.user.name && (
                    <p className="text-md font-bold">{jobRequest.user.name}</p>
                  )}
                </div>
                {jobRequest.user.email && (
                  <p className="text-sm text-gray-600">{jobRequest.user.email}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {jobRequest.descriptions.map((description, index) => (
        <div key={index} className="flex flex-col justify-center items-start gap-2">
          <p className="text-lg font-semibold w-full">{description}</p>
          <div className={`w-full flex ${pathname.includes(`${jobRequest.id}`) ? 'justify-center' : 'justify-start'}`}>
            {jobRequest.images[index] && (
                <div className={`relative flex w-full ${pathname.includes(`${jobRequest.id}`) ? 'max-w-[1080px]' : 'max-w-[540px]'} h-full mb-6`}>
                  <AspectRatio ratio={1 / 1}>
                    <Image
                      src={jobRequest.images[index] || ''}  // Fallback to an empty string if null
                      alt={`Image ${index + 1}`}
                      sizes={`${pathname.includes(`${jobRequest.id}`) ? '1080px' : '540px'}`}
                      fill
                      className="rounded object-cover"
                    />
                  </AspectRatio>
                </div>
            )}
          </div>
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
      {jobRequest.createdAt && (
        <div className="text-gray-500 flex gap-2 w-full justify-end"><p className='hidden sm:block'>posted</p>{formatDate(jobRequest.createdAt)}</div>
      )}
    </div>
  );
};

export default JobBox;