import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

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
          employees: {
            some: {
              userId: userId,
              permissions: {
                path: [permissionTag],
                equals: true,
              },
            },
          },
        },
        include: {
          employees: {
            where: {
              userId: userId,
              permissions: {
                path: [permissionTag],
                equals: true,
              },
            },
          },
        },
      });
      
      // TODO: remove this?
      //console.log('Companies with permission fetched:', companiesWithPermission);
      //res.status(200).json(companiesWithPermission);
      
    return NextResponse.json(companiesWithPermission, { status: 200 });
  } catch (error) {
    console.error('Error fetching companies with permission:', error);
    return NextResponse.json({ error: 'Error fetching companies with permission' }, { status: 500 });
  }
}