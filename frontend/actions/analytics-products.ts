'use server'; // Ensures this runs on the server side

import { dbPrisma } from '@/lib/db'; // Import your Prisma instance

// Function to fetch product analytics data
export const fetchProductAnalytics = async () => {
  const products = await dbPrisma.product.findMany({
    select: {
      createdAt: true,
    },
  });

  if (products.length === 0) {
    return { data: [] };
  }

  // Sort products to find the first and last created dates
  products.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const firstProductDate = products[0].createdAt;
  const lastProductDate = products[products.length - 1].createdAt;
  const today = new Date();

  // Aggregate data by day
  const dailyCounts: Record<string, number> = {};

  products.forEach((product) => {
    const date = new Date(product.createdAt).toISOString().split('T')[0]; // Format as YYYY-MM-DD
    dailyCounts[date] = (dailyCounts[date] || 0) + 1; // Count products per day
  });

  // Calculate cumulative product growth over time
  const cumulativeData = Object.entries(dailyCounts).reduce((acc, [date, count]) => {
    const previousCount = acc.length > 0 ? acc[acc.length - 1].products : 0;
    acc.push({ date: new Date(date), products: previousCount + count });
    return acc;
  }, [] as { date: Date; products: number }[]);

  return {
    data: [
      {
        label: 'Product Growth',
        data: cumulativeData,
      },
    ],
    firstProductDate,
    lastProductDate,
    today,
  };
};