import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CompanyListResponseSchema } from '@/lib/types/company';

const isDev = process.env.NODE_ENV !== 'production';
const LOG_PREFIX = '[frontend/app/api/companies/permission-filter-companies/route.ts]';

const permissionFilterSchema = z.object({
  permissionTag: z.string().trim().min(1).max(100),
  // legacy payload; ignored unless admin
  userId: z.string().trim().min(1).max(200).optional(),
  companyId: z.string().trim().min(1).max(200).optional(),
});

export async function POST(req: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bodyResult = await parseJsonOrError(req, permissionFilterSchema);
    if (!bodyResult.ok) return bodyResult.response;

    const { userId: requestedUserId, permissionTag } = bodyResult.data;
    const isAdmin = session.role === 'ADMIN' || session.role === 'OWNER';
    const userId = requestedUserId && isAdmin ? requestedUserId : session.id;
  
      // Fetch companies where the user has the specific permission
      const companiesWithPermission = await dbPrisma.company.findMany({
        where: {
          Employee: {
            some: {
              userId: userId,
              permissions: {
                path: [permissionTag],
                equals: true,
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });
      
      // TODO: remove this?
      //console.log('Companies with permission fetched:', companiesWithPermission);
      //res.status(200).json(companiesWithPermission);
      
    const parsed = CompanyListResponseSchema.safeParse(
      companiesWithPermission.map((c) => ({
        id: String(c.id),
        name: String(c.name),
        description: c.description ?? null,
      }))
    );
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid POST DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error('Error fetching companies with permission:', error);
    return NextResponse.json({ error: 'Error fetching companies with permission' }, { status: 500 });
  }
}