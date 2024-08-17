// frontend\app\api\companies\route.ts

import { dbPrisma } from '@/lib/db';
import { Company } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

const LOG_PREFIX = '[frontend/app/api/companies/route.ts]'
export async function GET() {
    try {
      const companies: Company[] = await dbPrisma.company.findMany();
      console.log(LOG_PREFIX, 'companies: ', companies);
      return NextResponse.json(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      return new NextResponse('Internal Server Error', { status: 500 });
    }
  }