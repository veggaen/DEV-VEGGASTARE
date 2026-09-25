import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { isDemoUserId } from '@/lib/demo-policy';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const querySchema = z.object({
  search: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['OWNER', 'ADMIN', 'USER']).optional(),
  sortBy: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict();

function reply(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', ...extra } });
}

export async function GET(request: Request) {
  try {
    const actor = await MyLibUserAuth();
    if (!actor?.id) return reply({ error: 'Sign in to manage users.' }, 401);
    if (isDemoUserId(actor.id) || !isAdmin(actor.role)) return reply({ error: 'Admin access is required.' }, 403);
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return reply({ error: 'Invalid directory filters.' }, 400);
    const rate = await checkRateLimit('admin-users:' + actor.id, 'read');
    if (!rate.success) return reply({ error: 'Please wait before refreshing users.' }, 429, { 'Retry-After': String(Math.max(1, rate.resetIn)) });
    const { search, page, limit, role, sortBy, sortOrder } = parsed.data;
    // PostgreSQL contains/ILIKE treats % and _ as wildcards unless escaped.
    const literal = search.replace(/[\\%_]/g, '\\$&');
    const where = {
      ...(role ? { role } : {}),
      ...(literal ? { OR: [
        { name: { contains: literal, mode: 'insensitive' as const } },
        { email: { contains: literal, mode: 'insensitive' as const } },
        { id: { contains: literal } },
      ] } : {}),
    };
    const [users, total] = await Promise.all([
      dbPrisma.user.findMany({
        where, orderBy: [{ [sortBy]: sortOrder }, { id: 'asc' }], skip: (page - 1) * limit, take: limit,
        select: {
          id: true, name: true, email: true, image: true, role: true,
          verificationTier: true, verificationScore: true, createdAt: true, emailVerified: true,
          _count: { select: { Company_Company_ownerIdToUser: true, Employee: true, Order: true } },
        },
      }),
      dbPrisma.user.count({ where }),
    ]);
    return reply({ users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch {
    console.error('[api/admin/users] Directory read failed');
    return reply({ error: 'Users could not be loaded. Try again.' }, 500);
  }
}

/** No bulk mutation is implemented. Never report a fictitious edit or audit it. */
export async function POST(_request: Request) {
  try {
    const actor = await MyLibUserAuth();
    if (!actor?.id) return reply({ error: 'Sign in to manage users.' }, 401);
    if (isDemoUserId(actor.id) || !isAdmin(actor.role)) return reply({ error: 'Admin access is required.' }, 403);
    return reply({ error: 'Bulk user actions are not available.' }, 405, { Allow: 'GET' });
  } catch {
    console.error('[api/admin/users] Access check failed');
    return reply({ error: 'User access could not be checked. Try again.' }, 500);
  }
}
