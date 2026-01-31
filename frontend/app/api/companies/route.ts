// frontend\app\api\companies\route.ts

import { dbPrisma } from '@/lib/db';
import { NextResponse, type NextRequest } from 'next/server';
import { MyLibUserAuth } from '@/lib/user-auth';
import { CompanyListResponseSchema } from '@/lib/types/company';

const LOG_PREFIX = '[frontend/app/api/companies/route.ts]'
export async function GET() {
    try {
      const session = await MyLibUserAuth();
      if (!session?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const isAdmin = session.role === 'ADMIN' || session.role === 'OWNER';
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const companies = await dbPrisma.company.findMany({
        select: {
          id: true,
          name: true,
          description: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      const parsed = CompanyListResponseSchema.safeParse(companies);
      if (!parsed.success) {
        console.error(LOG_PREFIX, 'Invalid GET DTO:', parsed.error);
        return NextResponse.json(
          { error: 'Internal Server Error', issues: parsed.error.issues },
          { status: 500 }
        );
      }

      return NextResponse.json(parsed.data);
    } catch (error) {
      console.error('Error fetching companies:', error);
      return new NextResponse('Internal Server Error', { status: 500 });
    }
  }