'use server'; // Ensures this runs on the server side

import { dbPrisma } from '@/lib/db'; // Import your Prisma instance

// Function to fetch user analytics data
export const fetchUserAnalytics = async () => {
  const users = await dbPrisma.user.findMany({
    select: {
      createdAt: true,
    },
  });

  if (users.length === 0) {
    return { data: [] };
  }

  // Sort users to find the first and last created dates
  users.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const firstUserDate = users[0].createdAt;
  const lastUserDate = users[users.length - 1].createdAt;
  const today = new Date();

  // Aggregate data by day
  const dailyCounts: Record<string, number> = {};

  users.forEach((user) => {
    const date = new Date(user.createdAt).toISOString().split('T')[0]; // Format as YYYY-MM-DD
    dailyCounts[date] = (dailyCounts[date] || 0) + 1; // Count users per day
  });

  // Calculate cumulative user growth over time
  const cumulativeData = Object.entries(dailyCounts).reduce((acc, [date, count]) => {
    const previousCount = acc.length > 0 ? acc[acc.length - 1].users : 0;
    acc.push({ date: new Date(date), users: previousCount + count });
    return acc;
  }, [] as { date: Date; users: number }[]);

  return {
    data: [
      {
        label: 'User Growth',
        data: cumulativeData,
      },
    ],
    firstUserDate,
    lastUserDate,
    today,
  };
};