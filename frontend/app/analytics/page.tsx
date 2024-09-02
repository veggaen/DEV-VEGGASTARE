'use client';

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
        <h1 className={styles.header}>Analytics Dashboard</h1>
        <div className={styles.description}>
          <p>
            Welcome to the **Analytics Hub**. Here, you can explore a variety of growth metrics and trends across different parts of this platform, from user engagement and product performance to broader public metrics.
          </p>
          <p>
            Dive into detailed analytics to gain valuable insights that help drive your business strategy and understand your impact.
          </p>
          <p>
            Select from the available options below to get started with specific analytics, and stay tuned for more categories coming soon.
          </p>
        </div>
        <div className={styles.linkContainer}>
          <Link href="/analytics/users" className={styles.buttonRep}>
            Users
          </Link>
          <Link href="/analytics/products" className={styles.buttonRep}>
            Products
          </Link>
          <Link href="/analytics/companies" className={styles.buttonRep}>
            Companies
          </Link>
          {/* Future links can be added here */}
        </div>
      </div>
    </div>
  );
};

export default MyPageAnalytics;