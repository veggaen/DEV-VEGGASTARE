import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseQueryOrError } from '@/lib/api-validate';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { CompaniesByUserRelationResponseSchema } from '@/lib/types/company';

const isDev = process.env.NODE_ENV !== 'production';
const LOG_PREFIX = '[frontend/app/api/companies/filter-by-user-relation/route.ts]';

const querySchema = z.object({
  userId: z.string().trim().min(1).max(200).optional(),
});

export async function GET(req: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const queryResult = parseQueryOrError(req, querySchema);
  if (!queryResult.ok) return queryResult.response;

  const requestedUserId = queryResult.data.userId;
  const isAdmin = session.role === 'ADMIN' || session.role === 'OWNER';
  const userId = requestedUserId && isAdmin ? requestedUserId : session.id;

  try {
    const companies = await dbPrisma.company.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { creatorId: userId },
          {
            Employee: {
              some: { userId },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        logo: true,
        bannerImage: true,
        orgType: true,
        createdAt: true,
        ownerId: true,
        creatorId: true,
        _count: {
          select: {
            Employee: true,
          },
        },
        Employee: {
          select: {
            id: true,
            userId: true,
            role: true,
            permissions: true,
            createdAt: true,
          },
        },
      },
    });

    const toRecordOrUndefined = (val: unknown): Record<string, unknown> | undefined => {
      if (!val || typeof val !== 'object' || Array.isArray(val)) return undefined;
      return val as Record<string, unknown>;
    };

    const dto = companies.map((company) => ({
      id: String(company.id),
      name: String(company.name),
      description: company.description ?? null,
      logo: Array.isArray(company.logo) ? company.logo : null,
      bannerImage: Array.isArray(company.bannerImage) ? company.bannerImage : null,
      orgType: company.orgType ?? null,
      createdAt: company.createdAt instanceof Date ? company.createdAt.toISOString() : String(company.createdAt),
      ownerId: String(company.ownerId),
      creatorId: String(company.creatorId),
      _count: {
        employees: company._count?.Employee ?? 0,
      },
      employees: Array.isArray(company.Employee)
        ? company.Employee.map((employee) => ({
            id: String(employee.id),
            userId: String(employee.userId),
            role: employee.role as any,
            permissions: toRecordOrUndefined(employee.permissions),
            createdAt:
              employee.createdAt instanceof Date
                ? employee.createdAt.toISOString()
                : String(employee.createdAt),
          }))
        : [],
    }));

    const parsed = CompaniesByUserRelationResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to fetch companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}