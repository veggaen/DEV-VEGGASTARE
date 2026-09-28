import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { isDemoUserId } from '@/lib/demo-policy';
import { checkRateLimit } from '@/lib/rate-limit';
import { auditDataForDisplay, auditQuery } from '@/lib/audit-log-policy';

const summarySelect = { id: true, adminId: true, action: true, targetType: true, targetId: true, reason: true, createdAt: true } as const;
function reply(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', ...extra } });
}

export async function GET(request: Request) {
  try {
    const actor = await MyLibUserAuth();
    if (!actor?.id) return reply({ error: 'Sign in to view the audit log.' }, 401);
    if (actor.role !== 'OWNER' || actor.isDemo || actor.isImpersonating || isDemoUserId(actor.id)) return reply({ error: 'Owner access is required.' }, 403);
    const params = new URL(request.url).searchParams;
    if (new Set(params.keys()).size !== [...params].length) return reply({ error: 'Invalid audit filters.' }, 400);
    const query = auditQuery.safeParse(Object.fromEntries(params));
    if (!query.success) return reply({ error: 'Invalid audit filters.' }, 400);
    const rate = await checkRateLimit('admin-audit:' + actor.id, 'read');
    if (!rate.success) return reply({ error: 'Wait a moment before refreshing.' }, 429, { 'Retry-After': String(Math.max(1, rate.resetIn)) });
    const adminSelect = { id: true, name: true, email: true, image: true } as const;
    if ('entry' in query.data) {
      const entry = await dbPrisma.adminAuditLog.findUnique({ where: { id: query.data.entry }, select: {
        ...summarySelect, previousData: true, newData: true, ipAddress: true, userAgent: true,
      } });
      if (!entry) return reply({ error: 'This audit entry is unavailable.' }, 404);
      const admin = await dbPrisma.user.findUnique({ where: { id: entry.adminId }, select: adminSelect });
      return reply({ entry: { ...entry,
        previousData: auditDataForDisplay(entry.previousData), newData: auditDataForDisplay(entry.newData),
        admin: admin ?? { id: entry.adminId, name: null, email: null, image: null },
      } });
    }
    const { page, limit, action, targetType, adminId, targetId, startDate, endDate } = query.data;
    const where = { ...(action && { action }), ...(targetType && { targetType }), ...(adminId && { adminId }), ...(targetId && { targetId }),
      ...((startDate || endDate) && { createdAt: { ...(startDate && { gte: new Date(startDate) }), ...(endDate && { lte: new Date(endDate) }) } }),
    };
    const [logs, total] = await dbPrisma.$transaction([
      dbPrisma.adminAuditLog.findMany({ where, select: summarySelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
      dbPrisma.adminAuditLog.count({ where }),
    ], { isolationLevel: 'RepeatableRead' });
    const admins = logs.length ? await dbPrisma.user.findMany({ where: { id: { in: [...new Set(logs.map(row => row.adminId))] } }, select: adminSelect }) : [];
    const adminMap = new Map(admins.map(admin => [admin.id, admin]));
    return reply({ logs: logs.map(row => ({ ...row, admin: adminMap.get(row.adminId) ?? { id: row.adminId, name: null, email: null, image: null } })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    console.error('[api/admin/audit-log] Read failed');
    return reply({ error: 'The audit log could not be loaded. Try again.' }, 503);
  }
}
