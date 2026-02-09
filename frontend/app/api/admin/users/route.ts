import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, logAdminAction, ADMIN_USER_EDITABLE_FIELDS, sanitizeFields } from '@/lib/admin';
import { AdminAction, AdminTargetType } from '@/generated/prisma/browser';

const LOG_PREFIX = '[api/admin/users]';

// GET /api/admin/users - List all users with search/filter
export async function GET(request: NextRequest) {
  const session = await MyLibUserAuth();
  
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const role = searchParams.get('role');
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  try {
    const where = {
      AND: [
        search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { id: { contains: search } },
          ],
        } : {},
        role ? { role: role as 'OWNER' | 'ADMIN' | 'USER' } : {},
      ],
    };

    const [users, total] = await Promise.all([
      dbPrisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          verificationTier: true,
          verificationScore: true,
          createdAt: true,
          emailVerified: true,
          _count: {
            select: {
              Company_Company_ownerIdToUser: true,
              Employee: true,
              Order: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbPrisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error listing users:`, error);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

// POST /api/admin/users - Bulk actions (future use)
export async function POST(request: NextRequest) {
  const session = await MyLibUserAuth();
  
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, userIds, reason } = body;

    if (!action || !userIds || !Array.isArray(userIds)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Log the bulk action attempt
    await logAdminAction({
      adminId: session.id,
      action: AdminAction.EDIT,
      targetType: AdminTargetType.USER,
      targetId: userIds.join(','),
      newData: { action, userCount: userIds.length },
      reason,
    });

    // Placeholder for bulk actions - implement as needed
    return NextResponse.json({ 
      message: 'Bulk action received',
      action,
      userCount: userIds.length,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error processing bulk action:`, error);
    return NextResponse.json({ error: 'Failed to process bulk action' }, { status: 500 });
  }
}
