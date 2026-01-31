import { dbPrisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';

// Next.js 16+ params type
type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    // Authentication required
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { userId } = await context.params;
  
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // IDOR Protection: Users can only access their own orders (admins can access all)
    if (session.user.id !== userId && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Cannot access other user\'s orders' }, { status: 403 });
    }
    
    // Rate limiting
    const identifier = getClientIdentifier(request, session.user.id);
    const rateLimitResult = checkRateLimit(identifier, 'read');
    if (!rateLimitResult.success) {
      return rateLimitedResponse(rateLimitResult);
    }
  
    try {
      const order = await dbPrisma.order.findMany({
        where: {
          userId,
        },
        include: {
          Payment: true,
        },
        take: 100, // Pagination limit for safety
        orderBy: {
          createdAt: 'desc',
        },
      });
  
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
  
      return NextResponse.json(order);
    } catch (error) {
      console.error('Error fetching order:', error);
      return NextResponse.json({ error: 'Error fetching order' }, { status: 500 });
    }
  }