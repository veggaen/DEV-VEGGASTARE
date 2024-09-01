import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Fetch product data from your database
    const products = await dbPrisma.product.findMany({
      select: {
        createdAt: true,
      },
    });

    if (products.length === 0) {
      return NextResponse.json({ data: [], error: 'No products found' });
    }

    // Determine the first product created date and today's date
    const firstProductDate = new Date(Math.min(...products.map(product => product.createdAt.getTime())));
    const today = new Date();

    // Prepare daily data from firstProductDate to today
    const productGrowthData: Record<string, number> = {};
    for (let d = new Date(firstProductDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD format
      productGrowthData[dateKey] = 0; // Initialize all days with 0
    }

    // Populate the data with actual product growth counts
    products.forEach(product => {
      const dateKey = product.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD format
      productGrowthData[dateKey] += 1; // Increment product count for that date
    });

    // Convert to cumulative data format for the chart
    const cumulativeData = Object.entries(productGrowthData).reduce(
      (acc, [date, count]) => {
        const previousCount = acc.length > 0 ? acc[acc.length - 1].users : 0;
        acc.push({ date: new Date(date), users: previousCount + count });
        return acc;
      },
      [] as { date: Date; users: number }[]
    );

    // Send response
    return NextResponse.json({
      data: [{ label: 'Product Growth', data: cumulativeData }],
      firstProductDate: firstProductDate.toISOString(),
      lastProductDate: products[products.length - 1].createdAt.toISOString(),
      today: today.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching product analytics data:', error);
    return NextResponse.json({ error: 'Failed to fetch product analytics data' }, { status: 500 });
  }
}