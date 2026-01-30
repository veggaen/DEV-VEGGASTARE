import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseQueryOrError } from '@/lib/api-validate';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

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
      include: {
        Employee: true,
      },
    });

    return NextResponse.json(companies, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to fetch companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}