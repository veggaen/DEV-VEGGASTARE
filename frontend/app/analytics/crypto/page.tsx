'use client';

import CryptoPriceChart from '@/components/uicustom/charts/analytics/CryptoPriceChart';
import React from 'react';

const styles = {
  buttonRep:
    'border bg-gray-300/50 border-gray-500/10 dark:bg-zinc-600 dark:border-zinc-700 text-black/80 hover:text-black dark:text-white/80 hover:dark:text-white transition duration-300 ease-in-out hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 active:border active:border-sky-500 hover:bg-sky-400 dark:hover:bg-sky-700 px-4 py-2 rounded-lg',
  container:
    'flex flex-col items-center justify-between min-h-[calc(100vh-102px)] bg-gray-100 dark:bg-gray-900 p-6 text-center',
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
      <div className="max-w-7xl lg:max-w-[80%] w-full">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
          Crypto Price Overview
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 mb-8">
          This chart displays the price of selected cryptocurrency in your selected currency and date range.
        </p>
        <CryptoPriceChart />
      </div>
      <footer className="mt-8 text-center text-gray-500 dark:text-gray-400 text-sm">
        Data provided by the <a href="https://www.coingecko.com/" className="text-blue-500 hover:underline">CoinGecko API</a>. This application is powered by a free API tier, which has some limitations such as data availability for up to 365 days. If you&apos;d like to see more features or support further development, consider sending a friendly donation to the owner of this site. Thank you for your support!
      </footer>
    </div>
  );
};

export default MyPageAnalytics;