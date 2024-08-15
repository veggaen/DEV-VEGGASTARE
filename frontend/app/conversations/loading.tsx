'use client';

import React, { useEffect, useState } from 'react';
import Spinner from '@/components/uicustom/spinner';

const LoadingConversations: React.FC = () => {
  const [skeletonCount, setSkeletonCount] = useState(1);

  return (
    <div className="flex flex-col justify-start items-center p-4">
      <div className="w-full md:max-w-[1440px]">
        <h2 className="text-2xl font-bold mb-4">Your Conversations</h2>
        <div className="flex flex-col items-center">
          <ul className="space-y-4 w-full">
            {[...Array(1)].map((_, index) => (
              <li
                key={index}
                className="bg-white dark:bg-gray-800 p-4 rounded shadow animate-pulse flex justify-center items-center"
                style={{ height: '80px' }}
              >
                <Spinner />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LoadingConversations;