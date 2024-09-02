'use server'; // Ensures this runs on the server side

import { dbPrisma } from '@/lib/db'; // Import your Prisma instance

// Function to fetch company analytics data
export const fetchCompanyAnalytics = async () => {
  const companies = await dbPrisma.company.findMany({
    select: {
      createdAt: true,
    },
  });

  if (companies.length === 0) {
    return { data: [] };
  }

  // Sort companies to find the first and last created dates
  companies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const firstCompanyDate = companies[0].createdAt;
  const lastCompanyDate = companies[companies.length - 1].createdAt;
  const today = new Date();

  // Aggregate data by day
  const dailyCounts: Record<string, number> = {};

  companies.forEach((company) => {
    const date = new Date(company.createdAt).toISOString().split('T')[0]; // Format as YYYY-MM-DD
    dailyCounts[date] = (dailyCounts[date] || 0) + 1; // Count companies per day
  });

  // Calculate cumulative company growth over time
  const cumulativeData = Object.entries(dailyCounts).reduce((acc, [date, count]) => {
    const previousCount = acc.length > 0 ? acc[acc.length - 1].companies : 0;
    acc.push({ date: new Date(date), companies: previousCount + count });
    return acc;
  }, [] as { date: Date; companies: number }[]);

  return {
    data: [
      {
        label: 'Company Growth',
        data: cumulativeData,
      },
    ],
    firstCompanyDate,
    lastCompanyDate,
    today,
  };
};