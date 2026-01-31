import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { CompaniesPublicResponseSchema } from '@/lib/types/company';

const isDev = process.env.NODE_ENV !== 'production';
const LOG_PREFIX = '[frontend/app/api/companies/public/route.ts]';

export async function GET() {
  try {
    const companies = await dbPrisma.company.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        creatorId: true,
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

    const dto = companies.map((company) => ({
      id: String(company.id),
      name: String(company.name),
      description: company.description ?? null,
      logo: Array.isArray(company.logo) ? company.logo : null,
      bannerImage: Array.isArray(company.bannerImage) ? company.bannerImage : null,
      orgType: company.orgType ?? null,
      createdAt: company.createdAt instanceof Date ? company.createdAt.toISOString() : String(company.createdAt),
      creator: {
        id: String(company.User_Company_creatorIdToUser?.id ?? company.creatorId),
        name: company.User_Company_creatorIdToUser?.name ?? null,
      },
      _count: {
        employees: company._count?.Employee ?? 0,
      },
    }));

    const parsed = CompaniesPublicResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error('Error fetching public companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}
