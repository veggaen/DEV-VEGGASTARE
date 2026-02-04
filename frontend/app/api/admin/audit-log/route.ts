import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { isOwner } from '@/lib/admin';

const LOG_PREFIX = '[api/admin/audit-log]';

// GET /api/admin/audit-log - View audit log (OWNER only)
export async function GET(request: NextRequest) {
  const session = await MyLibUserAuth();
  
  // Only OWNER can view the full audit log
  if (!session?.id || !isOwner(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const adminId = searchParams.get('adminId');
  const action = searchParams.get('action');
  const targetType = searchParams.get('targetType');
  const targetId = searchParams.get('targetId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const where = {
      AND: [
        adminId ? { adminId } : {},
        action ? { action: action as 'VIEW' | 'EDIT' | 'DELETE' | 'CREATE' | 'ROLE_CHANGE' | 'VERIFY' | 'SUSPEND' | 'UNSUSPEND' | 'IMPERSONATE' | 'EXPORT' } : {},
        targetType ? { targetType: targetType as 'USER' | 'COMPANY' | 'EMPLOYEE' | 'PRODUCT' | 'ORDER' | 'CONVERSATION' | 'WAREHOUSE' } : {},
        targetId ? { targetId } : {},
        startDate ? { createdAt: { gte: new Date(startDate) } } : {},
        endDate ? { createdAt: { lte: new Date(endDate) } } : {},
      ].filter(obj => Object.keys(obj).length > 0),
    };

    const [logs, total] = await Promise.all([
      dbPrisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbPrisma.adminAuditLog.count({ where }),
    ]);

    // Get admin user info for display
    const adminIds = [...new Set(logs.map(log => log.adminId))];
    const admins = await dbPrisma.user.findMany({
      where: { id: { in: adminIds } },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });
    const adminMap = new Map(admins.map(a => [a.id, a]));

    // Enrich logs with admin info
    const enrichedLogs = logs.map(log => ({
      ...log,
      admin: adminMap.get(log.adminId) || { id: log.adminId, name: 'Unknown', email: null, image: null },
    }));

    return NextResponse.json({
      logs: enrichedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching audit log:`, error);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
