import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { AnalyticsUsersResponseSchema } from '@/lib/types/analytics';

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
      const dto = { data: [], error: 'No users found' };
      const parsed = AnalyticsUsersResponseSchema.safeParse(dto);
      return NextResponse.json(parsed.success ? parsed.data : dto);
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
        acc.push({ date: new Date(date).toISOString(), users: previousCount + count });
        return acc;
      },
      [] as { date: string; users: number }[]
    );

    // Send response
    const dto = {
      data: [{ label: 'User Growth', data: cumulativeData }],
      firstUserDate: firstUserDate.toISOString(),
      lastUserDate: users[users.length - 1].createdAt.toISOString(),
      today: today.toISOString(),
    };

    const parsed = AnalyticsUsersResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('Invalid analytics/users DTO:', parsed.error.issues);
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
    console.error('Error fetching analytics data:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
  }
}