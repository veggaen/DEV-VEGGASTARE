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

    // Fetch company data from your database with limit for safety
    const companies = await dbPrisma.company.findMany({
      select: {
        createdAt: true,
      },
      take: 10000, // Safety limit to prevent unbounded queries
    });

    if (companies.length === 0) {
      return NextResponse.json({ data: [], error: 'No companies found' });
    }

    // Determine the first company created date and today's date
    const firstCompanyDate = new Date(Math.min(...companies.map(company => company.createdAt.getTime())));
    const today = new Date();

    // Prepare daily data from firstCompanyDate to today
    const companyGrowthData: Record<string, number> = {};
    for (let d = new Date(firstCompanyDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD format
      companyGrowthData[dateKey] = 0; // Initialize all days with 0
    }

    // Populate the data with actual company growth counts
    companies.forEach(company => {
      const dateKey = company.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD format
      companyGrowthData[dateKey] += 1; // Increment company count for that date
    });

    // Convert to cumulative data format for the chart
    const cumulativeData = Object.entries(companyGrowthData).reduce(
      (acc, [date, count]) => {
        const previousCount = acc.length > 0 ? acc[acc.length - 1].companies : 0;
        acc.push({ date: new Date(date), companies: previousCount + count });
        return acc;
      },
      [] as { date: Date; companies: number }[]
    );

    // Send response
    return NextResponse.json({
      data: [{ label: 'Company Growth', data: cumulativeData }],
      firstCompanyDate: firstCompanyDate.toISOString(),
      lastCompanyDate: companies[companies.length - 1].createdAt.toISOString(),
      today: today.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
  }
}