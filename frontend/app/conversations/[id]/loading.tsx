import React from 'react';
import Spinner from '@/components/uicustom/spinner';

const LoadingConversation: React.FC = () => {
  return (
    <div className="flex flex-col h-[calc(100%-102px)] bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 md:p-8 space-y-2">
      <div className="flex flex-col gap-2 bg-white dark:bg-black/40 rounded-lg shadow-md p-4">

        {/* Simulating the loading of messages */}
        <ul className="space-y-4 w-full">
          {[...Array(1)].map((_, index) => (
            <li
              key={index}
              className="bg-gray-200 dark:bg-gray-700 p-4 rounded shadow animate-pulse flex justify-center items-center"
              style={{ height: '80px' }} // Adjust height as needed
            >
              <Spinner /> {/* Spinner inside each skeleton */}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default LoadingConversation;