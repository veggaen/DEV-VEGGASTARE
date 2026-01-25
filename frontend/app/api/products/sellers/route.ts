import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export interface SellerWithCount {
  id: string;
  name: string;
  type: 'user' | 'company';
  count: number;
}

export async function GET() {
  try {
    // Get product counts grouped by userId
    const userCounts = await dbPrisma.product.groupBy({
      by: ['userId'],
      _count: { id: true },
    });

    // Get product counts grouped by companyId (where companyId is not null)
    const companyCounts = await dbPrisma.product.groupBy({
      by: ['companyId'],
      where: { companyId: { not: null } },
      _count: { id: true },
    });

    // Create lookup maps for counts
    const userCountMap = new Map(userCounts.map((u) => [u.userId, u._count.id]));
    const companyCountMap = new Map(
      companyCounts.map((c) => [c.companyId, c._count.id])
    );

    // Fetch user details for sellers
    const userIds = userCounts.map((u) => u.userId);
    const users = await dbPrisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    // Fetch company details for sellers
    const companyIds = companyCounts
      .map((c) => c.companyId)
      .filter((id): id is string => id !== null);
    const companies = await dbPrisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true },
    });

    // Combine sellers with counts
    const sellers: SellerWithCount[] = [
      ...users.map((user) => ({
        id: user.id,
        name: user.name ?? 'Unknown',
        type: 'user' as const,
        count: userCountMap.get(user.id) ?? 0,
      })),
      ...companies.map((company) => ({
        id: company.id,
        name: company.name,
        type: 'company' as const,
        count: companyCountMap.get(company.id) ?? 0,
      })),
    ];

    // Sort by count descending
    sellers.sort((a, b) => b.count - a.count);

    return NextResponse.json(sellers);
  } catch (error) {
    console.error('Failed to fetch sellers:', error);
    return NextResponse.json({ error: 'Failed to fetch sellers' }, { status: 500 });
  }
}