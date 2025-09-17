import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetch unique seller names from products
    const sellersFromUsers = await dbPrisma.product.findMany({
      distinct: ['userId'],
      where: {
        userId: { not: null },
      },
      select: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const sellersFromCompanies = await dbPrisma.product.findMany({
      distinct: ['companyId'],
      where: {
        companyId: { not: null },
      },
      select: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Combine and map sellers
    const sellers = [
      ...sellersFromUsers.map((item) => ({
        id: item.user.id,
        name: item.user.name,
        type: 'user',
      })),
      ...sellersFromCompanies.map((item) => ({
        id: item.company.id,
        name: item.company.name,
        type: 'company',
      })),
    ];

    return NextResponse.json(sellers);
  } catch (error) {
    console.error('Failed to fetch sellers:', error);
    return NextResponse.json({ error: 'Failed to fetch sellers' }, { status: 500 });
  }
}