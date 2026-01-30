import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const companies = await dbPrisma.company.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        logo: true,
        bannerImage: true,
        orgType: true,
        createdAt: true,
        User_Company_creatorIdToUser: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            Employee: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error('Error fetching public companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}
