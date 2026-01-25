// frontend\app\api\companies\route.ts

import { dbPrisma } from '@/lib/db';
import { Company } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';
import { MyLibUserAuth } from '@/lib/user-auth';

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

      const companies: Company[] = await dbPrisma.company.findMany();
      return NextResponse.json(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      return new NextResponse('Internal Server Error', { status: 500 });
    }
  }