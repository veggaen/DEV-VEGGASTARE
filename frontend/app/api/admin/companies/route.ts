import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, logAdminAction } from '@/lib/admin';
import { AdminAction, AdminTargetType } from '@/generated/prisma/browser';

const LOG_PREFIX = '[api/admin/companies]';

// GET /api/admin/companies - List all companies with search/filter
export async function GET(request: NextRequest) {
  const session = await MyLibUserAuth();
  
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  try {
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { orgNumber: { contains: search } },
        { id: { contains: search } },
      ],
    } : {};

    const [companies, total] = await Promise.all([
      dbPrisma.company.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          logo: true,
          orgNumber: true,
          orgType: true,
          createdAt: true,
          User_Company_ownerIdToUser: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          _count: {
            select: {
              Employee: true,
              Product: true,
              Sale: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbPrisma.company.count({ where }),
    ]);

    return NextResponse.json({
      companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error listing companies:`, error);
    return NextResponse.json({ error: 'Failed to list companies' }, { status: 500 });
  }
}
