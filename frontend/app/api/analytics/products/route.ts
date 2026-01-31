import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';

export async function GET(request: Request) {
  try {
    // Authentication: Only admins can access analytics
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check for admin role
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    // Rate limiting: analytics queries are expensive
    const identifier = getClientIdentifier(request, session.user.id);
    const rateLimitResult = checkRateLimit(identifier, 'analytics');
    if (!rateLimitResult.success) {
      return rateLimitedResponse(rateLimitResult);
    }

    // Fetch product data from your database with limit for safety
    const products = await dbPrisma.product.findMany({
      select: {
        createdAt: true,
      },
      take: 10000, // Safety limit to prevent unbounded queries
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