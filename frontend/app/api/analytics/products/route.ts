import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { AnalyticsProductsResponseSchema } from '@/lib/types/analytics';

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
      const dto = { data: [], error: 'No products found' };
      const parsed = AnalyticsProductsResponseSchema.safeParse(dto);
      return NextResponse.json(parsed.success ? parsed.data : dto);
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
        acc.push({ date: new Date(date).toISOString(), users: previousCount + count });
        return acc;
      },
      [] as { date: string; users: number }[]
    );

    // Send response
    const dto = {
      data: [{ label: 'Product Growth', data: cumulativeData }],
      firstProductDate: firstProductDate.toISOString(),
      lastProductDate: products[products.length - 1].createdAt.toISOString(),
      today: today.toISOString(),
    };

    const parsed = AnalyticsProductsResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('Invalid analytics/products DTO:', parsed.error.issues);
      return NextResponse.json(
        {
          error: 'Invalid response shape',
          issues: process.env.NODE_ENV === 'development' ? parsed.error.issues : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error('Error fetching product analytics data:', error);
    return NextResponse.json({ error: 'Failed to fetch product analytics data' }, { status: 500 });
  }
}