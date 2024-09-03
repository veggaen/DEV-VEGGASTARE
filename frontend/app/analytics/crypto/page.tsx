'use client';

import EthereumPriceChart from '@/components/uicustom/charts/analytics/EthereumPriceChart';
import Link from 'next/link';
import React from 'react';

const styles = {
  buttonRep:
    'border bg-gray-300/50 border-gray-500/10 dark:bg-slate-600 dark:border-slate-700 text-black/80 hover:text-black dark:text-white/80 hover:dark:text-white transition duration-300 ease-in-out hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 active:border active:border-sky-500 hover:bg-sky-400 dark:hover:bg-sky-700 px-4 py-2 rounded-lg',
  container:
    'flex flex-col items-center justify-center min-h-[calc(100vh-102px)] bg-gray-100 dark:bg-gray-900 p-6 text-center',
  header:
    'text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white',
  description:
    'text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-8 space-y-4',
  linkContainer:
    'flex flex-col sm:flex-row justify-center items-center gap-2 p-4 w-full',
};

const MyPageAnalytics = () => {
  return (
    <div className={styles.container}>
      <div className="max-w-4xl w-full">
          <EthereumPriceChart />
      </div>
    </div>
  );
};

export default MyPageAnalytics;