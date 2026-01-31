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

    // Fetch user data from your database with limit for safety
    const users = await dbPrisma.user.findMany({
      select: {
        createdAt: true,
      },
      take: 10000, // Safety limit to prevent unbounded queries
    });

    if (users.length === 0) {
      return NextResponse.json({ data: [], error: 'No users found' });
    }

    // Determine the first user created date and today's date
    const firstUserDate = new Date(Math.min(...users.map(user => user.createdAt.getTime())));
    const today = new Date();

    // Prepare daily data from firstUserDate to today
    const userGrowthData: Record<string, number> = {};
    for (let d = new Date(firstUserDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD format
      userGrowthData[dateKey] = 0; // Initialize all days with 0
    }

    // Populate the data with actual user growth counts
    users.forEach(user => {
      const dateKey = user.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD format
      userGrowthData[dateKey] += 1; // Increment user count for that date
    });

    // Convert to cumulative data format for the chart
    const cumulativeData = Object.entries(userGrowthData).reduce(
      (acc, [date, count]) => {
        const previousCount = acc.length > 0 ? acc[acc.length - 1].users : 0;
        acc.push({ date: new Date(date), users: previousCount + count });
        return acc;
      },
      [] as { date: Date; users: number }[]
    );

    // Send response
    return NextResponse.json({
      data: [{ label: 'User Growth', data: cumulativeData }],
      firstUserDate: firstUserDate.toISOString(),
      lastUserDate: users[users.length - 1].createdAt.toISOString(),
      today: today.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
  }
}