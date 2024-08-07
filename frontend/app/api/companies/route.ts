// frontend\app\api\companies\route.ts

import { dbPrisma } from '@/lib/db';
import { Company } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET() {
    try {
      const companies: Company[] = await dbPrisma.company.findMany();
      return NextResponse.json(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      return new NextResponse('Internal Server Error', { status: 500 });
    }
  }